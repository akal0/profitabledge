"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

import ChevronRight from "@/public/icons/chevron-right.svg";
import Plans from "./components/plans";
import Personal from "./components/personal";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type OnboardingStep = 1 | 2 | 3;

const Page = () => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const router = useRouter();

  const steps = [
    {
      id: 1,
      name: "Profile",
      status:
        currentStep === 1
          ? "current"
          : currentStep > 1
          ? "completed"
          : "upcoming",
    },
    {
      id: 2,
      name: "Select a plan",
      status:
        currentStep === 2
          ? "current"
          : currentStep > 2
          ? "completed"
          : "upcoming",
    },
    {
      id: 3,
      name: "Add an account",
      status:
        currentStep === 3
          ? "current"
          : currentStep > 3
          ? "completed"
          : "upcoming",
    },
  ];

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-sidebar">
      <div className="flex flex-col">
        <div className="w-full h-20 flex justify-between items-center px-25 text-xs">
          <p className="font-bold">profitabledge</p>

          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                <h1
                  className={`${
                    step.status === "current"
                      ? "text-white"
                      : step.status === "completed"
                      ? "text-emerald-500"
                      : "text-secondary"
                  }`}
                >
                  {step.name}
                </h1>
                {index < steps.length - 1 && (
                  <ChevronRight
                    className={`${
                      step.status === "current"
                        ? "stroke-white"
                        : step.status === "completed"
                        ? "stroke-emerald-500"
                        : "stroke-secondary"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <Button
            onClick={handleLogout}
            className="shadow-sidebar-button border-[0.5px] border-white/5 rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar dark:hover:bg-sidebar text-white w-max text-xs hover:!brightness-110 duration-250 flex py-2 items-center justify-center cursor-pointer"
          >
            Log out
          </Button>
        </div>

        <Separator />
      </div>

      <div className="px-25 h-full max-w-7xl mx-auto flex flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center justify-center w-full max-w-2xl min-w-2xl gap-12">
          {/* <h1 className="font-bold tracking-wide uppercase"> Profitabledge </h1> */}

          <div className="flex gap-4 w-full">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex flex-col gap-4 flex-1 items-center"
              >
                <p
                  className={`text-xs font-medium ${
                    step.status === "current"
                      ? "text-white"
                      : step.status === "completed"
                      ? "text-emerald-500"
                      : "text-white/25"
                  }`}
                >
                  {step.name}
                </p>

                <div className="relative h-2.5 bg-sidebar-accent rounded-full w-full shadow-sidebar-button overflow-hidden">
                  <div
                    className={`absolute inset-1 transition-all duration-1000 ease-out rounded-full shadow-sidebar-button ${
                      step.status === "completed"
                        ? "bg-emerald-500"
                        : step.status === "current"
                        ? "bg-amber-500"
                        : "bg-sidebar"
                    }`}
                    style={{
                      transformOrigin: "left",
                      width:
                        step.status === "completed" || step.status === "current"
                          ? "calc(100% - 8px)"
                          : "calc(100% - 8px)",
                      animation:
                        step.status === "current"
                          ? "slideInLeftConstrained 0.8s ease-in-out forwards"
                          : undefined,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          // <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
          //   <h2 className="text-2xl font-bold text-white">
          //     Tell us about yourself
          //   </h2>
          //   <div className="w-full space-y-4">
          //     <div>
          //       <label className="block text-sm font-medium text-white mb-2">
          //         Full Name
          //       </label>
          //       <input
          //         type="text"
          //         className="w-full px-4 py-3 bg-sidebar border border-white/10 rounded-lg text-white placeholder:text-white/40"
          //         placeholder="Enter your full name"
          //       />
          //     </div>
          //     <div>
          //       <label className="block text-sm font-medium text-white mb-2">
          //         Email
          //       </label>
          //       <input
          //         type="email"
          //         className="w-full px-4 py-3 bg-sidebar border border-white/10 rounded-lg text-white placeholder:text-white/40"
          //         placeholder="Enter your email"
          //       />
          //     </div>
          //     <div>
          //       <label className="block text-sm font-medium text-white mb-2">
          //         Trading Experience
          //       </label>
          //       <select className="w-full px-4 py-3 bg-sidebar border border-white/10 rounded-lg text-white">
          //         <option value="">Select your experience level</option>
          //         <option value="beginner">Beginner (0-1 years)</option>
          //         <option value="intermediate">Intermediate (1-3 years)</option>
          //         <option value="advanced">Advanced (3+ years)</option>
          //       </select>
          //     </div>
          //   </div>
          //   <Button
          //     onClick={() => setCurrentStep(2)}
          //     className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          //   >
          //     Continue to Plan Selection
          //   </Button>
          // </div>

          <Personal onNext={() => setCurrentStep(2)} />
        )}

        {currentStep === 2 && (
          <div className="flex flex-col items-center gap-8 w-full">
            <Plans />
            <div className="flex gap-4 max-w-7xl w-full">
              <Button
                onClick={() => setCurrentStep(1)}
                className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex py-2 items-center justify-center"
              >
                Back
              </Button>

              <Button
                onClick={() => setCurrentStep(3)}
                className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-600 cursor-pointer text-white flex-1 text-xs hover:!brightness-105 duration-250 flex py-2 items-center justify-center"
              >
                Continue to Account Setup
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
            <h2 className="text-2xl font-bold text-white">
              Add your trading account
            </h2>
            <div className="w-full space-y-6">
              <div className="bg-sidebar border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Import via CSV
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  Upload your trading history from your broker to get started
                  quickly.
                </p>
                <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                  <p className="text-white/40">
                    Drag and drop your CSV file here, or click to browse
                  </p>
                </div>
              </div>
              <div className="bg-sidebar border border-white/10 rounded-lg p-6 opacity-50">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Connect Broker (Coming Soon)
                </h3>
                <p className="text-white/60 text-sm">
                  Direct integration with popular brokers for real-time sync.
                </p>
              </div>
            </div>
            <div className="flex gap-4 w-full">
              <Button
                onClick={() => setCurrentStep(2)}
                className="flex-1 py-3 bg-sidebar border border-white/10 text-white rounded-lg transition-colors hover:bg-white/5"
              >
                Back
              </Button>
              <Button className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">
                Complete Setup
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;
