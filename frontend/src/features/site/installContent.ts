import { appConfig } from "@/lib/config";

export const REPO_URL = appConfig.repoUrl;
export const ZIP_URL = `${REPO_URL}/archive/refs/heads/main.zip`;
export const INSTALL_SCRIPT_URL =
  "https://raw.githubusercontent.com/Devanshgoel-123/ledgerline/main/install.sh";
export const LOCAL_URL = "http://localhost:3000";

export type OsId = "macos" | "windows" | "linux";

export interface InstallMethod {
  id: string;
  title: string;
  summary: string;
  /** Run in order, in one terminal. */
  commands: string[];
  note?: string;
}

export interface OsGuide {
  id: OsId;
  label: string;
  terminal: string;
  prerequisites: { text: string; href?: string; linkText?: string }[];
  /** One command that confirms Docker is ready. */
  check: string;
  methods: InstallMethod[];
  openNote: string;
}

const ONE_LINE: InstallMethod = {
  id: "one-line",
  title: "One line",
  summary: "Downloads Ledgerline into a folder called ledgerline in your home folder, then starts it.",
  commands: [`curl -fsSL ${INSTALL_SCRIPT_URL} | sh`],
  note: "Read the script first if you like: open the address above in your browser.",
};

const CLONE: InstallMethod = {
  id: "clone",
  title: "Clone with git",
  summary: "Best if you want to follow updates or read the code.",
  commands: [`git clone ${REPO_URL}.git`, "cd ledgerline", "./ledgerline start"],
};

const ZIP_UNIX: InstallMethod = {
  id: "zip",
  title: "Download the zip",
  summary: "No git needed. Unzip it anywhere, then run one command from that folder.",
  commands: ["cd ~/Downloads/ledgerline-main", "./ledgerline start"],
  note: "Download the zip, open it to unzip, then run these in a terminal. If you see “permission denied”, run chmod +x ledgerline first.",
};

const ZIP_WSL: InstallMethod = {
  id: "zip",
  title: "Download the zip",
  summary: "Download and unzip inside Ubuntu, so the files live where Docker runs fastest.",
  commands: [
    `curl -fsSLo ledgerline.zip ${ZIP_URL}`,
    "unzip ledgerline.zip",
    "cd ledgerline-main",
    "./ledgerline start",
  ],
  note: "If unzip is missing, install it with sudo apt install unzip.",
};

export const OS_GUIDES: OsGuide[] = [
  {
    id: "macos",
    label: "macOS",
    terminal: "Terminal (in Applications › Utilities)",
    prerequisites: [
      {
        text: "Docker Desktop for Mac, installed and running (the whale icon in the menu bar).",
        href: "https://docs.docker.com/desktop/setup/install/mac-install/",
        linkText: "Get Docker Desktop",
      },
      { text: "About 3 GB of free disk space and 4 GB of memory for Docker." },
    ],
    check: "docker compose version",
    methods: [ONE_LINE, CLONE, ZIP_UNIX],
    openNote: "Your browser opens at http://localhost:3000 when it is ready.",
  },
  {
    id: "windows",
    label: "Windows (WSL)",
    terminal: "the Ubuntu app (WSL)",
    prerequisites: [
      {
        text: "WSL with Ubuntu. In PowerShell as administrator, run wsl --install, then restart.",
        href: "https://learn.microsoft.com/windows/wsl/install",
        linkText: "WSL install guide",
      },
      {
        text: "Docker Desktop for Windows, with Settings › Resources › WSL integration turned on for Ubuntu.",
        href: "https://docs.docker.com/desktop/setup/install/windows-install/",
        linkText: "Get Docker Desktop",
      },
      { text: "Run every command below in the Ubuntu terminal, not in PowerShell." },
    ],
    check: "docker compose version",
    methods: [ONE_LINE, CLONE, ZIP_WSL],
    openNote: "If no browser opens, go to http://localhost:3000 in Edge or Chrome on Windows.",
  },
  {
    id: "linux",
    label: "Linux",
    terminal: "your terminal",
    prerequisites: [
      {
        text: "Docker Engine with the Compose plugin (docker compose, not docker-compose).",
        href: "https://docs.docker.com/engine/install/",
        linkText: "Install Docker Engine",
      },
      {
        text: "Your user in the docker group, so commands work without sudo: sudo usermod -aG docker $USER, then log out and back in.",
      },
    ],
    check: "docker compose version",
    methods: [ONE_LINE, CLONE, ZIP_UNIX],
    openNote: "Your browser opens at http://localhost:3000 when it is ready.",
  },
];

/** What `./ledgerline start` does the first time, in order. */
export const FIRST_RUN_STEPS = [
  "Checks that Docker is installed and running, and says what to do if it is not.",
  "Creates a private settings file (.env) with random keys. There is nothing for you to fill in.",
  "Builds Ledgerline and starts three parts on your computer: the database, the service that reads your statements, and the web app. The first build takes a few minutes; later starts take seconds.",
  "Waits until everything answers, then opens http://localhost:3000.",
];

export const EVERYDAY_COMMANDS: { command: string; does: string }[] = [
  { command: "./ledgerline start", does: "Start Ledgerline and open it. Safe to run any time." },
  { command: "./ledgerline open", does: "Open it in your browser." },
  { command: "./ledgerline stop", does: "Stop it. Your data stays." },
  { command: "./ledgerline status", does: "Show whether each part is running and healthy." },
  { command: "./ledgerline logs", does: "Show what Ledgerline is doing, for troubleshooting." },
  { command: "./ledgerline update", does: "Get the latest version and restart. Your data stays." },
  { command: "./ledgerline backup", does: "Save a copy of your data to the backups folder." },
  { command: "./ledgerline restore <file>", does: "Put back a saved copy." },
  { command: "./ledgerline uninstall", does: "Remove Ledgerline. Asks before deleting your data." },
];
