import { createFileRoute } from "@tanstack/react-router";
import { BirthdayApp } from "@/birthday/App";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "The Vault — Birthday Arcade" },
      {
        name: "description",
        content: "Small rewards for a very big deal. Spend your arcade tickets on something lovely.",
      },
      { property: "og:title", content: "The Vault — Birthday Arcade" },
      {
        property: "og:description",
        content: "Small rewards for a very big deal. Spend your arcade tickets on something lovely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BirthdayApp,
});
