"use client";

import { useId, useMemo, useState, forwardRef } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

const PasswordInput = forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ value, onChange, ...rest }, ref) => {
  const id = useId();
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const toggleVisibility = () => setIsVisible((prevState) => !prevState);

  const checkStrength = (pass: string) => {
    const requirements = [
      { regex: /.{8,}/, text: "At least 8 characters" },
      { regex: /[0-9]/, text: "At least 1 number" },
      { regex: /[a-z]/, text: "At least 1 lowercase letter" },
      { regex: /[A-Z]/, text: "At least 1 uppercase letter" },
    ];

    return requirements.map((req) => ({
      met: req.regex.test(pass),
      text: req.text,
    }));
  };

  const strength = checkStrength(String(value ?? ""));

  const strengthScore = useMemo(() => {
    return strength.filter((req) => req.met).length;
  }, [strength]);

  const getStrengthColor = (score: number) => {
    if (score === 0) return "bg-white/10";
    if (score <= 1) return "bg-rose-400";
    if (score <= 2) return "bg-amber-400";
    if (score === 3) return "bg-lime-300";
    return "bg-emerald-300";
  };

  return (
    <div>
      <div className="*:not-first:mt-2">
        <div className="relative">
          <Input
            id={id}
            className="pe-9"
            placeholder="Password"
            type={isVisible ? "text" : "password"}
            value={value}
            onChange={onChange}
            aria-describedby={`${id}-description`}
            ref={ref}
            {...rest}
          />
          <button
            className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md text-white/44 transition-colors outline-none hover:text-white focus:z-10 focus-visible:ring-[3px] focus-visible:ring-white/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={toggleVisibility}
            aria-label={isVisible ? "Hide password" : "Show password"}
            aria-pressed={isVisible}
            aria-controls="password"
          >
            {isVisible ? (
              <EyeOffIcon size={16} aria-hidden="true" />
            ) : (
              <EyeIcon size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div
        className="mt-2 mb-6 h-1 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={strengthScore}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-label="Password strength"
      >
        <div
          className={`h-full ${getStrengthColor(
            strengthScore
          )} transition-all duration-500 ease-out`}
          style={{ width: `${(strengthScore / 4) * 100}%` }}
        ></div>
      </div>

      <ul
        className="grid gap-2 gap-x-5 text-left font-semibold sm:grid-cols-2"
        aria-label="Password requirements"
      >
        {strength.map((req, index) => (
          <li key={index} className="flex items-center gap-2">
            {req.met ? (
              <CheckIcon
                size={16}
                className="text-emerald-300"
                aria-hidden="true"
              />
            ) : (
              <XIcon size={16} className="text-white/26" aria-hidden="true" />
            )}
            <span
              className={`text-xs ${
                req.met ? "text-emerald-200" : "text-white/42"
              }`}
            >
              {req.text}
              <span className="sr-only">
                {req.met ? " - Requirement met" : " - Requirement not met"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default PasswordInput;
