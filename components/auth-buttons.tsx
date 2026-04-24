"use client";

import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

type AuthButtonsProps = {
  isLoggedIn: boolean;
};

export function AuthButtons({ isLoggedIn }: AuthButtonsProps) {
  if (isLoggedIn) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </Button>
    );
  }

  return (
    <Button type="button" onClick={() => signIn("github", { callbackUrl: "/" })}>
      Sign in with GitHub
    </Button>
  );
}
