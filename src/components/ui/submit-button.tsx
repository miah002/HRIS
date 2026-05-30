"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Submit button that auto-disables and shows a spinner while the parent
 * <form action={...}> server action is pending. Must live inside a <form>.
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}
