"use client";

import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { useState } from "react";

import CircleCheck from "@/public/icons/circle-check.svg";
import { Button } from "@/components/ui/button";

const Plans = () => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div className="flex flex-col w-full items-center justify-center antialiased">
      <div className="flex w-full gap-6 max-h-128 group/container">
        {/* Explorer */}

        <div
          className="bg-sidebar border-[0.5px] border-white/5 shadow-sidebar-button rounded-lg w-full group h-full overflow-hidden transition-all duration-300 hover:scale-[103%]"
          style={{
            opacity: hoveredCard && hoveredCard !== "student" ? 0.2 : 1,
            filter:
              hoveredCard && hoveredCard !== "student" ? "blur(2.5px)" : "none",
          }}
          onMouseEnter={() => setHoveredCard("student")}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div>
            <div className="relative w-full h-32 p-3 px-6 flex items-end">
              <Image
                src="/plans/explorer.png"
                alt="explorer"
                fill
                className="object-cover opacity-75 shadow-secondary-button group-hover:opacity-100 transition duration-500 grayscale group-hover:grayscale-0"
              />

              <h1 className="text-xs text-white uppercase font-bold z-10">
                Student
              </h1>
            </div>
            <Separator />
          </div>

          <div className="py-4 flex flex-col gap-4 h-max">
            <h1 className="text-xs text-secondary leading-relaxed px-6 select-none">
              For those brave enough to venture into the markets. <br /> Your
              first step toward{" "}
              <span className="text-white font-semibold">
                profitable enlightenment.
              </span>
            </h1>

            <Separator />

            <div className="flex w-full justify-between px-6 select-none">
              <h1 className="text-white font-bold text-lg">Free</h1>

              <h1 className="bg-sidebar px-4 py-1.5 text-[10px] rounded-[6px] font-semibold select-none text-sidebar">
                .
              </h1>
            </div>

            <Separator />

            <div className="flex flex-col gap-4">
              <div className="px-6 py-1.5">
                <div className="flex flex-col gap-3 text-white/50 font-medium select-none">
                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      <span className="font-semibold text-white">
                        {" "}
                        50 edge credits{" "}
                      </span>{" "}
                      per month
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      Unlimited{" "}
                      <span className="font-semibold text-white">
                        {" "}
                        imported{" "}
                      </span>{" "}
                      accounts
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      3{" "}
                      <span className="font-semibold text-white">
                        {" "}
                        broker sync{" "}
                      </span>{" "}
                      accounts
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      Customizable{" "}
                      <span className="font-semibold text-white">
                        {" "}
                        profit and loss{" "}
                      </span>{" "}
                      cards
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      View only access to{" "}
                      <span className="font-semibold text-white">
                        {" "}
                        the community{" "}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6">
                <Button className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-violet-600 cursor-pointer text-white w-full text-xs hover:!brightness-105 duration-250 flex py-2 items-center justify-center">
                  Select plan
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Professional */}

        <div
          className="bg-sidebar border-[0.5px] border-white/5 shadow-sidebar-button rounded-lg w-full group h-full overflow-hidden transition-all duration-300 hover:scale-[103%]"
          style={{
            opacity: hoveredCard && hoveredCard !== "professional" ? 0.2 : 1,
            filter:
              hoveredCard && hoveredCard !== "professional"
                ? "blur(2.5px)"
                : "none",
          }}
          onMouseEnter={() => setHoveredCard("professional")}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div>
            <div className="relative w-full h-32 p-3 px-6 flex items-end">
              <Image
                src="/plans/trader.png"
                alt="explorer"
                fill
                className="object-cover opacity-75 shadow-secondary-button group-hover:opacity-100 transition duration-500 "
              />

              <div className="flex text-xs text-white uppercase font-bold z-10 w-full justify-between items-end select-none">
                <h1 className="">Professional</h1>
              </div>
            </div>
            <Separator />
          </div>

          <div className="py-4 flex flex-col gap-4 h-max ">
            <h1 className="text-xs text-secondary leading-relaxed px-6 select-none">
              When you're ready to start systematically{" "}
              <span className="text-white font-semibold">
                separating the market from your money.
              </span>
            </h1>

            <Separator />

            <div className="flex w-full justify-between px-6 select-none">
              <h1 className="text-white text-lg font-bold ">
                $25{" "}
                <span className="text-secondary text-sm font-normal">
                  {" "}
                  / month{" "}
                </span>
              </h1>

              <h1 className="bg-blue-600 px-4 py-1.5 text-[10px] rounded-[6px] shadow-sidebar-button font-semibold">
                Best offer
              </h1>
            </div>

            <Separator />

            <div className="flex flex-col gap-4">
              <div className="px-6 py-1.5 select-none">
                <div className="flex flex-col gap-3 text-white/50 font-medium">
                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      Everything from the{" "}
                      <span className="font-semibold text-white">
                        Student plan
                      </span>{" "}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      <span className="font-semibold text-white">
                        {" "}
                        500 edge credits{" "}
                      </span>{" "}
                      per month
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      Unlimited{" "}
                      <span className="font-semibold text-white">
                        {" "}
                        broker sync{" "}
                      </span>{" "}
                      accounts
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      <span className="font-semibold text-white">
                        Smart notifications
                      </span>{" "}
                      system
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      A lot more{" "}
                      <span className="font-semibold text-white">features</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6">
                <Button className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-blue-600 hover:bg-blue-600 cursor-pointer text-white w-full text-xs hover:!brightness-105 duration-250 flex py-2 items-center justify-center">
                  Select plan
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Institutional */}

        <div
          className="bg-sidebar border-[0.5px] border-white/5 shadow-sidebar-button rounded-lg w-full group h-full overflow-hidden transition-all duration-300 hover:scale-[103%]"
          style={{
            opacity: hoveredCard && hoveredCard !== "institutional" ? 0.2 : 1,
            filter:
              hoveredCard && hoveredCard !== "institutional"
                ? "blur(2.5px)"
                : "none",
          }}
          onMouseEnter={() => setHoveredCard("institutional")}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div>
            <div className="relative w-full h-32 p-3 px-6 flex items-end">
              <Image
                src="/plans/institutional.png"
                alt="explorer"
                fill
                className="object-cover opacity-75 shadow-secondary-button group-hover:opacity-100 transition duration-500 grayscale group-hover:grayscale-0"
              />

              <h1 className="text-xs text-white uppercase font-bold z-10 select-none">
                Institutional
              </h1>
            </div>
            <Separator />
          </div>

          <div className="py-4 flex flex-col gap-4 h-max">
            <h1 className="text-xs text-secondary leading-relaxed px-6 select-none">
              For the elite few who want to crack the code — where{" "}
              <span className="text-white font-semibold">
                data becomes your unfair advantage.
              </span>
            </h1>

            <Separator />

            <div className="flex w-full justify-between px-6 select-none">
              <h1 className="text-white font-bold text-lg">
                $49{" "}
                <span className="text-secondary text-sm font-normal">
                  {" "}
                  / month{" "}
                </span>
              </h1>

              <h1 className="bg-sidebar px-4 py-1.5 text-[10px] rounded-[6px] font-semibold select-none text-sidebar">
                Best offer
              </h1>
            </div>

            <Separator />

            <div className="flex flex-col gap-4">
              <div className="px-6 py-1.5 select-none">
                <div className="flex flex-col gap-3 text-white/50 font-medium">
                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      Everything from the
                      <span className="font-semibold text-white">
                        {" "}
                        Professional plan
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      <span className="font-semibold text-white">
                        Unlimited edge credits
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      Access to{" "}
                      <span className="font-semibold text-white">
                        {" "}
                        copy trading tools{" "}
                      </span>{" "}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      <span className="font-semibold text-white">
                        {" "}
                        Smart trade tagging{" "}
                      </span>{" "}
                      system
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="fill-white size-4.5" />

                    <p>
                      Advanced
                      <span className="font-semibold text-white">
                        {" "}
                        comparative analytical{" "}
                      </span>
                      tools
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6">
                <Button className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-green-600 cursor-pointer text-white w-full text-xs hover:!brightness-105 duration-250 flex py-2 items-center justify-center">
                  Select plan
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Plans;
