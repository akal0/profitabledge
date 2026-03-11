import { db } from "../db";
import { pnlCardTemplate } from "../db/schema/trading";

const DEFAULT_TEMPLATES = [
  {
    name: "Purple Dream",
    description: "Modern gradient with purple and pink tones",
    backgroundType: "gradient" as const,
    backgroundValue: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    layout: {
      font: "Inter",
      fontSize: {
        title: 32,
        stat: 24,
        label: 14,
      },
      colors: {
        primary: "#ffffff",
        secondary: "#9CA3AF",
        accent: "#10B981",
        negative: "#EF4444",
      },
      elements: ["profit", "rr", "pips", "duration", "volume"],
      logoPosition: "bottom-right" as const,
    },
    isPublic: true,
    isSystem: true,
  },
  {
    name: "Ocean Blue",
    description: "Cool blue gradient perfect for winners",
    backgroundType: "gradient" as const,
    backgroundValue: "linear-gradient(135deg, #0061ff 0%, #60efff 100%)",
    layout: {
      font: "Inter",
      fontSize: {
        title: 32,
        stat: 24,
        label: 14,
      },
      colors: {
        primary: "#ffffff",
        secondary: "#CBD5E1",
        accent: "#22D3EE",
        negative: "#EF4444",
      },
      elements: ["profit", "rr", "pips", "duration", "volume"],
      logoPosition: "top-right" as const,
    },
    isPublic: true,
    isSystem: true,
  },
  {
    name: "Green Energy",
    description: "Fresh green gradient for profitable trades",
    backgroundType: "gradient" as const,
    backgroundValue: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    layout: {
      font: "Inter",
      fontSize: {
        title: 32,
        stat: 24,
        label: 14,
      },
      colors: {
        primary: "#ffffff",
        secondary: "#D1FAE5",
        accent: "#34D399",
        negative: "#F87171",
      },
      elements: ["profit", "rr", "pips", "duration", "volume"],
      logoPosition: "bottom-left" as const,
    },
    isPublic: true,
    isSystem: true,
  },
  {
    name: "Dark Mode",
    description: "Sleek dark theme for professional look",
    backgroundType: "gradient" as const,
    backgroundValue: "linear-gradient(135deg, #1e1e1e 0%, #434343 100%)",
    layout: {
      font: "Inter",
      fontSize: {
        title: 32,
        stat: 24,
        label: 14,
      },
      colors: {
        primary: "#ffffff",
        secondary: "#9CA3AF",
        accent: "#10B981",
        negative: "#EF4444",
      },
      elements: ["profit", "rr", "pips", "duration", "volume"],
      logoPosition: "top-left" as const,
    },
    isPublic: true,
    isSystem: true,
  },
  {
    name: "Gold Luxury",
    description: "Premium gold gradient for special trades",
    backgroundType: "gradient" as const,
    backgroundValue: "linear-gradient(135deg, #f09819 0%, #edde5d 100%)",
    layout: {
      font: "Inter",
      fontSize: {
        title: 32,
        stat: 24,
        label: 14,
      },
      colors: {
        primary: "#1F2937",
        secondary: "#6B7280",
        accent: "#059669",
        negative: "#DC2626",
      },
      elements: ["profit", "rr", "pips", "duration", "volume"],
      logoPosition: "bottom-right" as const,
    },
    isPublic: true,
    isSystem: true,
  },
  {
    name: "Sunset Vibes",
    description: "Warm sunset colors for evening wins",
    backgroundType: "gradient" as const,
    backgroundValue: "linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)",
    layout: {
      font: "Inter",
      fontSize: {
        title: 32,
        stat: 24,
        label: 14,
      },
      colors: {
        primary: "#ffffff",
        secondary: "#FEE2E2",
        accent: "#FBBF24",
        negative: "#991B1B",
      },
      elements: ["profit", "rr", "pips", "duration", "volume"],
      logoPosition: "top-right" as const,
    },
    isPublic: true,
    isSystem: true,
  },
  {
    name: "Minimal White",
    description: "Clean white background for simplicity",
    backgroundType: "solid" as const,
    backgroundValue: "#ffffff",
    layout: {
      font: "Inter",
      fontSize: {
        title: 32,
        stat: 24,
        label: 14,
      },
      colors: {
        primary: "#1F2937",
        secondary: "#6B7280",
        accent: "#10B981",
        negative: "#EF4444",
      },
      elements: ["profit", "rr", "pips", "duration", "volume"],
      logoPosition: "bottom-right" as const,
    },
    isPublic: true,
    isSystem: true,
  },
  {
    name: "Cyberpunk",
    description: "Neon vibes with futuristic feel",
    backgroundType: "gradient" as const,
    backgroundValue: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    layout: {
      font: "Inter",
      fontSize: {
        title: 32,
        stat: 24,
        label: 14,
      },
      colors: {
        primary: "#00FFF0",
        secondary: "#8B5CF6",
        accent: "#00FFF0",
        negative: "#FF00FF",
      },
      elements: ["profit", "rr", "pips", "duration", "volume"],
      logoPosition: "top-left" as const,
    },
    isPublic: true,
    isSystem: true,
  },
];

async function seedPnlTemplates() {
  console.log("🌱 Seeding PnL card templates...");

  try {
    // Clear existing system templates
    await db.delete(pnlCardTemplate).where({ isSystem: true } as any);
    console.log("✅ Cleared existing system templates");

    // Insert new templates
    for (const template of DEFAULT_TEMPLATES) {
      await db.insert(pnlCardTemplate).values({
        userId: null, // System templates have no user
        name: template.name,
        description: template.description,
        backgroundType: template.backgroundType,
        backgroundValue: template.backgroundValue,
        layout: template.layout as any,
        isPublic: template.isPublic,
        isSystem: template.isSystem,
      });
      console.log(`✅ Created template: ${template.name}`);
    }

    console.log(`\n🎉 Successfully seeded ${DEFAULT_TEMPLATES.length} templates!`);
  } catch (error) {
    console.error("❌ Error seeding templates:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedPnlTemplates()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedPnlTemplates };
