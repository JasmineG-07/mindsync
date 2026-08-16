import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc,
  query, where, updateDoc, arrayUnion, arrayRemove, getDoc, serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAEVoa4Q56If_mgiqfpQhnbPQngvtuBKnY",
  authDomain: "mindsync-3532b.firebaseapp.com",
  projectId: "mindsync-3532b",
  storageBucket: "mindsync-3532b.firebasestorage.app",
  messagingSenderId: "640835966617",
  appId: "1:640835966617:web:bbf0c5c88aacba7db7ca08",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return signOut(auth);
}

/* ---------- personal decks ---------- */

export async function saveDeck(userId, deckName, cards) {
  return await addDoc(collection(db, "decks"), {
    userId,
    name: deckName,
    cards,
    createdAt: new Date(),
  });
}

export async function getUserDecks(userId) {
  const q = query(collection(db, "decks"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteDeck(deckId) {
  await deleteDoc(doc(db, "decks", deckId));
}

/* ---------- classes ---------- */

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len) {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function generateClassCode(className) {
  const letters = (className.replace(/[^a-zA-Z]/g, "").toUpperCase() + "XXX").slice(0, 3);
  return `${letters}-${randomBlock(4)}`;
}

async function codeExists(code) {
  const q = query(collection(db, "classes"), where("code", "==", code));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function createClass(userId, userName, className) {
  let code = generateClassCode(className);
  let tries = 0;
  while (await codeExists(code)) {
    code = generateClassCode(className);
    tries += 1;
    if (tries > 5) throw new Error("Could not generate a unique code");
  }
  const ref = await addDoc(collection(db, "classes"), {
    name: className,
    code,
    ownerId: userId,
    ownerName: userName || "Unknown",
    members: [userId],
    memberNames: { [userId]: userName || "Unknown" },
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, code, name: className };
}

export async function joinClassByCode(userId, userName, rawCode) {
  const code = rawCode.trim().toUpperCase();
  const q = query(collection(db, "classes"), where("code", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("No class found with that code");

  const classDoc = snap.docs[0];
  const data = classDoc.data();
  if ((data.members || []).includes(userId)) {
    return { id: classDoc.id, ...data, alreadyMember: true };
  }

  await updateDoc(doc(db, "classes", classDoc.id), {
    members: arrayUnion(userId),
    [`memberNames.${userId}`]: userName || "Unknown",
  });
  return { id: classDoc.id, ...data, alreadyMember: false };
}

export async function getUserClasses(userId) {
  const q = query(collection(db, "classes"), where("members", "array-contains", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getClass(classId) {
  const snap = await getDoc(doc(db, "classes", classId));
  if (!snap.exists()) throw new Error("Class not found");
  return { id: snap.id, ...snap.data() };
}

export async function leaveClass(classId, userId) {
  await updateDoc(doc(db, "classes", classId), {
    members: arrayRemove(userId),
  });
}

export async function deleteClass(classId) {
  const q = query(collection(db, "classDecks"), where("classId", "==", classId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "classDecks", d.id))));
  await deleteDoc(doc(db, "classes", classId));
}

/* ---------- class decks ---------- */

export async function shareDeckToClass(classId, deckName, cards, authorId, authorName) {
  return await addDoc(collection(db, "classDecks"), {
    classId,
    name: deckName,
    cards,
    authorId,
    authorName: authorName || "Unknown",
    createdAt: new Date(),
  });
}

export async function getClassDecks(classId) {
  const q = query(collection(db, "classDecks"), where("classId", "==", classId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteClassDeck(deckId) {
  await deleteDoc(doc(db, "classDecks", deckId));
}

export async function addCardsToClassDeck(deckId, newCards) {
  const ref = doc(db, "classDecks", deckId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Deck not found");
  const existing = snap.data().cards || [];
  const merged = [...existing, ...newCards].map((c, i) => ({ id: i, q: c.q, a: c.a }));
  await updateDoc(ref, { cards: merged });
  return merged;
}
