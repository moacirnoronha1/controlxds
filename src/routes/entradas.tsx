import { createFileRoute } from "@tanstack/react-router";
import { MovForm } from "@/components/mov-form";

export const Route = createFileRoute("/entradas")({
  component: () => <MovForm tipo="entrada" />,
  head: () => ({
    meta: [
      { title: "Entradas de Estoque | GX Control" },
      { name: "description", content: "Registre e corrija entradas e lotes do estoque no GX Control." },
      { property: "og:title", content: "Entradas de Estoque | GX Control" },
      { property: "og:description", content: "Registro e correção de entradas e lotes do estoque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
