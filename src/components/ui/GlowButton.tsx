"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function GlowButton({
  variant = "primary",
  size = "md",
  children,
  className,
  ...props
}: GlowButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center font-bold tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase";
  
  const variants = {
    primary: "bg-duel-gold text-duel-bg hover:shadow-[0_0_20px_rgba(252,196,25,0.4)]",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-duel-gold/30 text-duel-gold hover:border-duel-gold hover:bg-duel-gold/10",
  };

  const sizes = {
    sm: "px-4 py-2 text-[10px]",
    md: "px-6 py-3 text-xs",
    lg: "px-8 py-4 text-sm",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], "rounded-xl", className)}
      {...props}
    >
      {children}
    </button>
  );
}
