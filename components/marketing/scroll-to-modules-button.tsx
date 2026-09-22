"use client";

import { Button } from "@/components/ui/button";

export function ScrollToModulesButton() {
  return (
    <Button
      size="lg"
      variant="outline"
      onClick={() => {
        document.getElementById("modules")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      Voir les modules
    </Button>
  );
}
