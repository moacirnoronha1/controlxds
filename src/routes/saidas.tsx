import { createFileRoute } from "@tanstack/react-router";
import { MovForm } from "@/components/mov-form";

export const Route = createFileRoute("/saidas")({
  component: () => <MovForm tipo="saida" />,
});
