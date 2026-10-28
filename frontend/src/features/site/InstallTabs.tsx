"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CopyCommand } from "./CopyCommand";
import { OS_GUIDES, ZIP_URL, type OsId } from "./installContent";

export function detectOs(userAgent: string): OsId {
  const ua = userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macos";
  if (ua.includes("linux") && !ua.includes("android")) return "linux";
  return "macos";
}

/** Install steps for macOS, Windows (WSL) and Linux; starts on the visitor's own system. */
export function InstallTabs({ headingLevel = 3 }: { headingLevel?: 3 | 4 }) {
  const [active, setActive] = useState<OsId>("macos");
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const Heading = `h${headingLevel}` as "h3" | "h4";

  useEffect(() => {
    // After hydration, so the server and first client render agree.
    const id = window.setTimeout(() => setActive(detectOs(navigator.userAgent)), 0);
    return () => window.clearTimeout(id);
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = OS_GUIDES.findIndex((os) => os.id === active);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % OS_GUIDES.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + OS_GUIDES.length) % OS_GUIDES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = OS_GUIDES.length - 1;
    else return;
    event.preventDefault();
    const id = OS_GUIDES[next]!.id;
    setActive(id);
    tabs.current[id]?.focus();
  }

  const guide = OS_GUIDES.find((os) => os.id === active)!;

  return (
    <div className="site-tabs">
      <div role="tablist" aria-label="Your computer" className="site-tablist">
        {OS_GUIDES.map((os) => (
          <button
            key={os.id}
            ref={(el) => {
              tabs.current[os.id] = el;
            }}
            type="button"
            role="tab"
            id={`os-tab-${os.id}`}
            aria-selected={os.id === active}
            aria-controls={`os-panel-${os.id}`}
            tabIndex={os.id === active ? 0 : -1}
            className="site-tab"
            onClick={() => setActive(os.id)}
            onKeyDown={onKeyDown}
          >
            {os.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`os-panel-${guide.id}`}
        aria-labelledby={`os-tab-${guide.id}`}
        className="site-tabpanel"
      >
        <Heading className="site-subhead">Before you start</Heading>
        <ul className="site-prereqs">
          {guide.prerequisites.map((item) => (
            <li key={item.text}>
              {item.text}{" "}
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer">
                  {item.linkText}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="site-small">
          Open {guide.terminal} and check that Docker answers:
        </p>
        <CopyCommand commands={[guide.check]} label="Check Docker" />

        <Heading className="site-subhead">Then pick one way to get it</Heading>
        <div className="site-methods">
          {guide.methods.map((method) => (
            <section key={method.id} className="site-method" aria-label={method.title}>
              <p className="site-method-title">{method.title}</p>
              <p className="site-small">
                {method.summary}
                {method.id === "zip" && guide.id !== "windows" ? (
                  <>
                    {" "}
                    <a href={ZIP_URL}>Download the zip</a>.
                  </>
                ) : null}
              </p>
              <CopyCommand commands={method.commands} label={`${method.title} on ${guide.label}`} />
              {method.note ? <p className="site-small site-muted">{method.note}</p> : null}
            </section>
          ))}
        </div>
        <p className="site-small">{guide.openNote}</p>
      </div>
    </div>
  );
}
