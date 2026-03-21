/**
 * Mock Phase 1 diagnosis sender.
 * Simulates the Chrome Extension POSTing a bug diagnosis to /api/diagnose.
 *
 * Usage:
 *   npx tsx scripts/mock-diagnose.ts [bug_number]
 *
 * Examples:
 *   npx tsx scripts/mock-diagnose.ts 1    # pointer-events-none bug
 *   npx tsx scripts/mock-diagnose.ts 2    # responsive grid bug
 *   npx tsx scripts/mock-diagnose.ts 3    # missing form onSubmit
 *   npx tsx scripts/mock-diagnose.ts 4    # z-index dropdown bug
 */

const API_URL = process.env.API_URL || "http://localhost:3002";
const API_KEY = process.env.API_KEY || "ghostbuster-test-key-2024";

const BUGS: Record<number, { description: string; component: string; root_cause: string; fix: string }> = {
  1: {
    description: "The 'View Projects' button in the hero section does not respond to clicks. It looks normal visually but is completely unclickable.",
    component: "Hero section CTA button ('View Projects')",
    root_cause: "The anchor element has a 'pointer-events-none' CSS class applied, which disables all mouse/touch interactions.",
    fix: "Remove the 'pointer-events-none' class from the 'View Projects' anchor element in src/app/page.tsx.",
  },
  2: {
    description: "The projects grid layout breaks on mobile screens below 768px. Cards are squished into 3 tiny columns instead of stacking.",
    component: "Projects section grid layout",
    root_cause: "The grid uses 'grid-cols-3' without responsive breakpoints, forcing 3 columns at all screen sizes.",
    fix: "Change 'grid-cols-3' to 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' in the projects grid div in src/app/page.tsx.",
  },
  3: {
    description: "The contact form submit button does nothing when clicked. The form fields work but submitting has no effect.",
    component: "Contact section form",
    root_cause: "The <form> element has no onSubmit handler. The submit button exists but the form never processes the submission.",
    fix: "Add an onSubmit handler to the form element that calls e.preventDefault() and processes the form data. Define a handleSubmit function in the component.",
  },
  4: {
    description: "On mobile, the navigation dropdown menu appears behind the hero section content and is not visible/clickable.",
    component: "Mobile navigation dropdown menu",
    root_cause: "The dropdown has z-10 but the hero section below has z-20, causing the dropdown to render behind the hero content.",
    fix: "Change the dropdown's z-index from z-10 to z-[100] in the mobile menu dropdown div in src/app/page.tsx.",
  },
};

async function main() {
  const bugNum = parseInt(process.argv[2] || "1", 10);
  const bug = BUGS[bugNum];

  if (!bug) {
    console.error(`Invalid bug number: ${bugNum}. Use 1-4.`);
    process.exit(1);
  }

  console.log(`\n🔍 Sending mock diagnosis for Bug #${bugNum}: ${bug.description.slice(0, 60)}...`);
  console.log(`📡 Target: ${API_URL}/api/diagnose\n`);

  // Tiny 1x1 white PNG as placeholder screenshot
  const PLACEHOLDER_SCREENSHOT =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  const diagnosis = {
    screenshot: PLACEHOLDER_SCREENSHOT,
    dom_snapshot: "<html><body><div id='app'><!-- demo app DOM --></div></body></html>",
    voice_transcript: `I found a bug on the page. ${bug.description}`,
    gemini_analysis: {
      bug_description: bug.description,
      affected_component: bug.component,
      root_cause: bug.root_cause,
      suggested_fix: bug.fix,
    },
    page_url: "https://ghost-buster-demo.vercel.app/",
    viewport: { width: 1440, height: 900 },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${API_URL}/api/diagnose`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(diagnosis),
    });

    const data = await res.json();

    if (res.ok) {
      console.log("✅ Diagnosis accepted!");
      console.log(`   Diagnosis ID: ${data.diagnosisId}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Message: ${data.message}`);
      console.log(`\n🤖 Agent is now working on the fix in the background.`);
      console.log(`   Check Supabase 'diagnoses' table for status updates.`);
    } else {
      console.error("❌ Failed:", res.status, data);
    }
  } catch (err) {
    console.error("❌ Request error:", err);
  }
}

main();
