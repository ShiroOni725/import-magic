import { createFileRoute } from "@tanstack/react-router";
import { BirthdayApp } from "@/birthday/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Birthday Arcade — For Adel, Level 02" },
      {
        name: "description",
        content:
          "A tiny birthday arcade made for Adel: four little games, a vault of rewards, and a letter with her name on it.",
      },
      { property: "og:title", content: "Birthday Arcade — For Adel, Level 02" },
      {
        property: "og:description",
        content: "Four small games, a letter, and a little room for the memories still to come.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BirthdayApp,
});
