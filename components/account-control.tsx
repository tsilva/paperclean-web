"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { CaretDown, UserCircle } from "@phosphor-icons/react";

function PreviewControl() {
  return (
    <button className="account-button" type="button" aria-label="Preview account">
      <UserCircle size={27} weight="regular" />
      <CaretDown size={15} weight="bold" />
    </button>
  );
}

function ClerkControl() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="account-button sign-in-control" type="button">
            <UserCircle size={27} />
            <span>Sign in</span>
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <div className="clerk-user-button">
          <UserButton
            appearance={{ elements: { avatarBox: { width: 36, height: 36 } } }}
            showName={false}
          />
        </div>
      </Show>
    </>
  );
}

export function AccountControl({ clerkEnabled }: { clerkEnabled: boolean }) {
  return clerkEnabled ? <ClerkControl /> : <PreviewControl />;
}
