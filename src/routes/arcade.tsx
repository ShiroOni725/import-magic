import { createFileRoute } from "@tanstack/react-router";
import { BirthdayApp } from "@/birthday/App";

export const Route = createFileRoute("/arcade")({
  head: () => ({
    meta: [
      { title: "The Arcade — Birthday Arcade" },
      {
        name: "description",
        content: "Four little games — a lucky wheel, cupid slots, kawaii memory, and a heart hunt.",
      },
      { property: "og:title", content: "The Arcade — Birthday Arcade" },
      {
        property: "og:description",
        content: "Four little games — a lucky wheel, cupid slots, kawaii memory, and a heart hunt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BirthdayApp,
});
