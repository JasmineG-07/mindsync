import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Firebase must be mocked before App is imported, since App calls it on mount.
jest.mock("./firebase", () => ({
  auth: {},
  signInWithGoogle: jest.fn(),
  signOutUser: jest.fn(),
  saveDeck: jest.fn(),
  getUserDecks: jest.fn(),
  deleteDeck: jest.fn(),
  createClass: jest.fn(),
  joinClassByCode: jest.fn(),
  getUserClasses: jest.fn(),
  leaveClass: jest.fn(),
  deleteClass: jest.fn(),
  shareDeckToClass: jest.fn(),
  getClassDecks: jest.fn(),
  deleteClassDeck: jest.fn(),
}));

import * as firebase from "./firebase";

let authCallback = null;
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (auth, cb) => {
    authCallback = cb;
    return () => {};
  },
}));

// These libraries are only used inside file-upload handlers, which tests don't exercise.
jest.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, version: "3.0.0", getDocument: jest.fn() }));
jest.mock("mammoth", () => ({ extractRawText: jest.fn() }));
jest.mock("jszip", () => ({ loadAsync: jest.fn() }));

import App from "./App";

const FAKE_USER = { uid: "u1", displayName: "Jasmine Test" };

function signIn() {
  authCallback(FAKE_USER);
}

function signOut() {
  authCallback(null);
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();

  // Create React App enables jest resetMocks, which strips implementations
  // set in the jest.mock factory. Re-apply them before every test.
  firebase.getUserDecks.mockResolvedValue([]);
  firebase.getUserClasses.mockResolvedValue([]);
  firebase.getClassDecks.mockResolvedValue([]);
  firebase.saveDeck.mockResolvedValue(undefined);
  firebase.deleteDeck.mockResolvedValue(undefined);
  firebase.deleteClass.mockResolvedValue(undefined);
  firebase.deleteClassDeck.mockResolvedValue(undefined);
  firebase.leaveClass.mockResolvedValue(undefined);
  firebase.shareDeckToClass.mockResolvedValue(undefined);
  firebase.createClass.mockResolvedValue({ id: "c1", code: "BIO-4X7K", name: "Biology" });
  firebase.joinClassByCode.mockResolvedValue({ id: "c1", name: "Biology", alreadyMember: false });
});

describe("authentication gate", () => {
  test("shows the landing page when signed out", async () => {
    render(<App />);
    await waitFor(() => signOut());
    expect(screen.getByText(/flashcards instantly/i)).toBeInTheDocument();
    expect(screen.getAllByText(/get started/i).length).toBeGreaterThan(0);
  });

  test("shows the app shell when signed in", async () => {
    render(<App />);
    await waitFor(() => signIn());
    expect(screen.getByText(/generate flashcards/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Classes" })).toBeInTheDocument();
  });

  test("greets the signed-in user by first name", async () => {
    render(<App />);
    await waitFor(() => signIn());
    expect(screen.getByText("Jasmine")).toBeInTheDocument();
  });
});

describe("landing page content", () => {
  test("lists the class groups feature", async () => {
    render(<App />);
    await waitFor(() => signOut());
    expect(screen.getByText(/class groups/i)).toBeInTheDocument();
  });

  test("renders the FAQ section", async () => {
    render(<App />);
    await waitFor(() => signOut());
    expect(screen.getByText(/common questions/i)).toBeInTheDocument();
    expect(screen.getByText(/what files can i upload/i)).toBeInTheDocument();
  });

  test("shows the copyright notice", async () => {
    render(<App />);
    await waitFor(() => signOut());
    expect(screen.getByText(/© 2026 MindSync/i)).toBeInTheDocument();
  });
});

describe("navigation", () => {
  test("switches to the Classes page", async () => {
    render(<App />);
    await waitFor(() => signIn());
    await userEvent.click(screen.getByRole("button", { name: "Classes" }));
    expect(await screen.findByText(/study together/i)).toBeInTheDocument();
  });

  test("switches to Settings and back to Home via the logo", async () => {
    render(<App />);
    await waitFor(() => signIn());

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByText(/default difficulty/i)).toBeInTheDocument();

    // "MindSync" also appears in the footer, so scope to the nav.
    const nav = screen.getByRole("navigation");
    await userEvent.click(within(nav).getByText("MindSync"));
    expect(await screen.findByText(/generate flashcards/i)).toBeInTheDocument();
  });

  test("Explore page filters decks by search term", async () => {
    render(<App />);
    await waitFor(() => signIn());
    await userEvent.click(screen.getByRole("button", { name: "Explore" }));

    const searchBox = await screen.findByPlaceholderText(/search decks/i);
    await userEvent.type(searchBox, "python");

    expect(screen.getByText("Python Basics")).toBeInTheDocument();
    expect(screen.queryByText("Biology 101")).not.toBeInTheDocument();
  });
});

describe("card generation flow", () => {
  test("shows a validation message when there is no input", async () => {
    render(<App />);
    await waitFor(() => signIn());

    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findByText(/paste notes or upload a file first/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("sends the selected difficulty to the API", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ flashcards: JSON.stringify([{ q: "Q1", a: "A1" }]) }),
    });

    render(<App />);
    await waitFor(() => signIn());

    await userEvent.type(screen.getByPlaceholderText(/paste lecture notes/i), "cell biology");
    await userEvent.click(screen.getByText("Advanced"));
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.difficulty).toBe("advanced");
    expect(body.notes).toBe("cell biology");
  });

  test("lands on the review screen after generating", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        flashcards: JSON.stringify([
          { q: "What is mitosis?", a: "Cell division" },
          { q: "What is DNA?", a: "Genetic material" },
        ]),
      }),
    });

    render(<App />);
    await waitFor(() => signIn());
    await userEvent.type(screen.getByPlaceholderText(/paste lecture notes/i), "notes");
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByText(/review your cards/i)).toBeInTheDocument();
    expect(screen.getByText("What is mitosis?")).toBeInTheDocument();
    expect(screen.getByText(/2 pending/i)).toBeInTheDocument();
  });

  test("surfaces the server's error message on failure", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ detail: "The AI account has no credits left." }),
    });

    render(<App />);
    await waitFor(() => signIn());
    await userEvent.type(screen.getByPlaceholderText(/paste lecture notes/i), "notes");
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByText(/no credits left/i)).toBeInTheDocument();
  });

  test("does not retry a 402, since it will not succeed", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ detail: "No credits." }),
    });

    render(<App />);
    await waitFor(() => signIn());
    await userEvent.type(screen.getByPlaceholderText(/paste lecture notes/i), "notes");
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(screen.getByText(/no credits/i)).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("review screen", () => {
  async function generateTwoCards() {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        flashcards: JSON.stringify([
          { q: "Card one question", a: "Card one answer" },
          { q: "Card two question", a: "Card two answer" },
        ]),
      }),
    });
    render(<App />);
    await waitFor(() => signIn());
    await userEvent.type(screen.getByPlaceholderText(/paste lecture notes/i), "notes");
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    await screen.findByText(/review your cards/i);
  }

  test("approving a card updates the counts", async () => {
    await generateTwoCards();
    const approveButtons = screen.getAllByTitle("Approve");
    await userEvent.click(approveButtons[0]);
    expect(await screen.findByText(/1 approved/i)).toBeInTheDocument();
    expect(screen.getByText(/1 pending/i)).toBeInTheDocument();
  });

  test("deleting a card excludes it from the saved deck", async () => {
    await generateTwoCards();
    const deleteButtons = screen.getAllByTitle("Delete");
    await userEvent.click(deleteButtons[0]);
    expect(await screen.findByText(/1 deleted/i)).toBeInTheDocument();

    await userEvent.click(screen.getByText(/save 1 cards/i));
    expect(await screen.findByText(/1 cards ready/i)).toBeInTheDocument();
  });

  test("edited text carries through to the deck", async () => {
    await generateTwoCards();
    await userEvent.click(screen.getAllByTitle("Edit")[0]);

    const questionBox = screen.getByDisplayValue("Card one question");
    await userEvent.clear(questionBox);
    await userEvent.type(questionBox, "My rewritten question");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("My rewritten question")).toBeInTheDocument();
  });
});

describe("streak tracking", () => {
  test("no streak badge before any activity", async () => {
    render(<App />);
    await waitFor(() => signIn());
    expect(screen.queryByText(/day streak/i)).not.toBeInTheDocument();
  });

  test("reads an existing streak from storage", async () => {
    localStorage.setItem(
      "ms_streak",
      JSON.stringify({ count: 5, lastDate: new Date().toDateString() })
    );
    render(<App />);
    await waitFor(() => signIn());
    expect(await screen.findByText(/5 day streak/i)).toBeInTheDocument();
  });
});

describe("resilience to bad data", () => {
  test("Classes page renders when the class query returns nothing", async () => {
    firebase.getUserClasses.mockResolvedValue(undefined);
    render(<App />);
    await waitFor(() => signIn());
    await userEvent.click(screen.getByRole("button", { name: "Classes" }));
    expect(await screen.findByText(/no classes yet/i)).toBeInTheDocument();
  });

  test("My Decks renders when the deck query returns nothing", async () => {
    firebase.getUserDecks.mockResolvedValue(undefined);
    render(<App />);
    await waitFor(() => signIn());
    await userEvent.click(screen.getByRole("button", { name: "My Decks" }));
    expect(await screen.findByText(/no decks saved yet/i)).toBeInTheDocument();
  });

  test("Classes page shows the empty state when the query fails", async () => {
    firebase.getUserClasses.mockRejectedValue(new Error("firestore down"));
    render(<App />);
    await waitFor(() => signIn());
    await userEvent.click(screen.getByRole("button", { name: "Classes" }));
    expect(await screen.findByText(/no classes yet/i)).toBeInTheDocument();
  });
});
