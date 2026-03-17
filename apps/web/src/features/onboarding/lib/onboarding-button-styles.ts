import {
  getPropAssignActionButtonClassName,
  type PropAssignActionButtonSize,
  type PropAssignActionButtonTone,
} from "@/features/accounts/lib/prop-assign-action-button";
import { cn } from "@/lib/utils";

export function getOnboardingButtonClassName({
  tone = "neutral",
  size = "default",
  className,
}: {
  tone?: PropAssignActionButtonTone;
  size?: PropAssignActionButtonSize;
  className?: string;
}) {
  return getPropAssignActionButtonClassName({
    tone,
    size,
    className: cn("gap-2", className),
  });
}
