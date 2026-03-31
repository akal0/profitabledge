"use client";

import Image from "next/image";

const LANDING_ACCENT_TEXT_STYLE = {
  backgroundImage:
    "linear-gradient(90deg, #00c2ff 0%, #ffffff 49%, #ffffff 57%, #fef427 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
} as const;

const SMART_SIGNALS_SECTION_TITLE_STYLE = {
  backgroundImage:
    "radial-gradient(110% 150% at 50% 0%, #17a1f3 0%, #e9f3eb 94%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
} as const;

function LandingCardNoise() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[3] overflow-hidden rounded-2xl"
    >
      <div className="absolute inset-0">
        <Image
          src="/assets/noise.png"
          alt=""
          fill
          className="object-cover opacity-100 mix-blend-soft-light"
          unoptimized
        />
      </div>
    </div>
  );
}

export function SmartSignalsSection() {
  return (
    <section
      className="relative w-full px-6 py-24 md:px-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-28"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "1px 1100px",
      }}
    >
      {/* Section header */}
      <div className="mb-8">
        <p
          className="mb-4 inline-block text-sm text-transparent font-medium"
          style={SMART_SIGNALS_SECTION_TITLE_STYLE}
        >
          The stuff your broker forgot
        </p>
        <h2
          className="max-w-3xl text-3xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-4xl md:text-4xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          A smarter way to spot mistakes,
          <br />
          stay on plan, and trade better
        </h2>
      </div>

      {/* Two-column grid */}
      <div className="grid gap-8 md:grid-cols-[1.50fr_0.92fr]">
        {/* Left: Notification card */}
        <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111111]">
          <LandingCardNoise />

          {/* Texture aligned to bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2]">
            <Image
              src="/assets/mask-texture.png"
              alt=""
              width={2460}
              height={1760}
              className="w-full h-auto opacity-45"
              unoptimized
            />
          </div>
          {/* Notification preview */}
          <div className="relative z-[4] px-6 pt-8 md:px-8 md:pt-10">
            <div className="relative mx-auto aspect-[602/231] w-full max-w-[602px]">
              <Image
                src="/landing/notifications-group.svg"
                alt="Notification examples showing reports, syncs, risk alerts, insights, and account updates"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </div>

          {/* Card text */}
          <div className="relative z-[4] px-6 pt-8 pb-12 text-center md:px-10">
            <h3
              className="text-lg font-semibold text-transparent"
              style={LANDING_ACCENT_TEXT_STYLE}
            >
              Forget signal groups.
              <br />
              These are signals built from your trades.
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/40">
              All your important updates in one place; reports, syncs, and smart
              nudges from Edgebot. No clutter, no distractions, <br />{" "}
              <span className="text-white font-medium">
                just what you need to stay on track and trade better.
              </span>
            </p>
          </div>
        </div>

        {/* Right: Edgebot card */}
        <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111111]">
          <LandingCardNoise />

          {/* Edgebot texture aligned to bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2]">
            <Image
              src="/assets/edgebot-texture.png"
              alt=""
              width={2460}
              height={1760}
              className="w-full h-auto opacity-45"
              unoptimized
            />
          </div>
          {/* Edgebot illustration — fills edge to edge */}
          <div className="relative z-[4] px-6 pt-8 md:px-8 md:pt-10">
            <div className="relative mx-auto aspect-[602/231] w-full max-w-[602px]">
              <Image
                src="/assets/edgebot-illustration.svg"
                alt="Edgebot assistant showing edge analysis, tag suggestions, and trade scoring"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </div>

          {/* Card text */}
          <div className="relative z-[4] px-6 pt-8 pb-12 text-center md:px-10">
            <h3
              className="text-lg font-semibold text-transparent"
              style={LANDING_ACCENT_TEXT_STYLE}
            >
              Smart enough to know your edge.
              <br />
              Quiet enough to let you take the credit.
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/40">
              A behind-the-scenes system that learns how you trade, surfaces
              what matters, and helps you make smarter decisions <br />{" "}
              <span className="text-white">
                without ever getting in the way.
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
