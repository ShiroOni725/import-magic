import { createFileRoute } from "@tanstack/react-router";
import { BirthdayApp } from "@/birthday/App";

export const Route = createFileRoute("/letter")({
  head: () => ({
    meta: [
      { title: "A Letter For You — Birthday Arcade" },
      {
        name: "description",
        content: "A sealed birthday letter, waiting just for Adel.",
      },
      { property: "og:title", content: "A Letter For You — Birthday Arcade" },
      {
        property: "og:description",
        content: "A sealed birthday letter, waiting just for Adel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BirthdayApp,
});
