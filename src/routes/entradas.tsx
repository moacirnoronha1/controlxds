import { createFileRoute } from "@tanstack/react-router";
import { MovForm } from "@/components/mov-form";

export const Route = createFileRoute("/entradas")({
  component: () => <MovForm tipo="entrada" />,
});
