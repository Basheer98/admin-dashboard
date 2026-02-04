"use client";

import React from "react";

type ConfirmFormProps = {
  message: string;
  children: React.ReactNode;
};

export function ConfirmForm({ message, children }: ConfirmFormProps) {
  return (
    <form
      method="POST"
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      {children}
    </form>
  );
}
