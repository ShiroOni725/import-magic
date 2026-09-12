import { createFileRoute } from "@tanstack/react-router";
import { BirthdayApp } from "@/birthday/App";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Birthday Arcade" },
      {
        name: "description",
        content: "The control booth of the Birthday Arcade — music, downloads, and a fresh start.",
      },
      { property: "og:title", content: "Settings — Birthday Arcade" },
      {
        property: "og:description",
        content: "The control booth of the Birthday Arcade — music, downloads, and a fresh start.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BirthdayApp,
});
