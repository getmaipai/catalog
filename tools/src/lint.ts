// The catalog's own package lint (session-d-packages-and-store.md step
// 6, docs/PACKAGES.md's bronze bar): manifest + recipe validation
// against schema/ (mirrored from home/spec/), five-plus routing
// examples, a privacy row per net: permission, banned trademark
// vocabulary and platform names in ids/names, and the rest of bronze
// (README, CHANGELOG, quality_scale.yaml with every bronze line met).
// A contributor runs this locally (tools/src/check.ts, the CLI); CI
// runs the identical function, never a second copy of the rule set.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCHEMA_DIR = join(import.meta.dir, "..", "..", "schema");

// One shared Ajv instance: schema/manifest.schema.json's own same-directory
// $refs (privacy-row.schema.json, settings-key.schema.json) resolve
// through addSchema() below, the same "every $id known up front" approach
// home/backend/src/lib/plugins.ts's own Ajv2020 instance would need if it
// validated cross-file refs (it doesn't - manifest.args is package-
// specific and has none). `strict: false`: manifest.schema.json's own
// `args`/`cache`/`warm` fields are intentionally open-ended
// (`additionalProperties: true` or unconstrained), which Ajv's strict
// mode would otherwise warn on as "possibly a typo."
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

const manifestSchema = JSON.parse(readFileSync(join(SCHEMA_DIR, "manifest.schema.json"), "utf-8")) as { $id: string };
// A bare relative $ref ("privacy-row.schema.json") resolves, per the JSON
// Schema spec, against the ENCLOSING schema's own $id - here that means
// joining it onto manifest.schema.json's own $id
// (".../home/spec/schemas/manifest.schema.json"), producing
// ".../home/spec/schemas/privacy-row.schema.json". The referenced file
// itself still carries its ORIGINAL cross-repo $id
// (".../.github/standards/schemas/privacy-row.schema.json", copied
// verbatim by scripts/refresh-schema.sh) - registering it under either
// that $id or its own bare filename left the ref Ajv actually computes
// unmatched, throwing "can't resolve reference" the moment
// manifest.schema.json compiled. Registering it under the SAME resolved
// key Ajv itself will look up sidesteps needing to rewrite the file's own
// $id at all.
for (const file of ["privacy-row.schema.json", "settings-key.schema.json"]) {
  const resolvedKey = new URL(file, manifestSchema.$id).toString();
  ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, file), "utf-8")), resolvedKey);
}
const validateManifest = ajv.compile(manifestSchema);
const validateRecipe = ajv.compile(JSON.parse(readFileSync(join(SCHEMA_DIR, "recipe.schema.json"), "utf-8")));

export interface LintResult {
  ok: boolean;
  errors: string[];
}

function fail(errors: string[]): LintResult {
  return { ok: errors.length === 0, errors };
}

// getmaipai/.github/CLAUDE.md > Trademarks: "Names only, descriptively" -
// a data_sources[] destination or a plain description sentence naming a
// compatible service is fine ("connects to YouTube"); the package's own
// identity (id, display) is not the place for another company's mark.
// This list is the well-known platforms the org's own docs already name
// by example (Trademarks section, docs/PACKAGES.md); extend it as a real
// submission needs to, never remove an entry to let one through.
const BANNED_PLATFORM_NAMES = [
  "youtube",
  "tiktok",
  "plex",
  "spotify",
  "reddit",
  "netflix",
  "instagram",
  "facebook",
  "twitter",
  "hulu",
  "disney",
  "amazon",
  "twitch",
  "discord",
  "pinterest",
  "snapchat",
  "whatsapp",
  "telegram",
] as const;

// getmaipai/.github/CLAUDE.md > Trademarks: "banned vocabulary in all
// copy" - phrasing that pitches a feature as a way around another
// service's rules or pricing, never a MaiPai feature description.
const BANNED_TRADEMARK_PHRASES = [/\bbypass\b/i, /\bfree [a-z]+ content\b/i, /\bad-free [a-z]+\b/i, /\bwithout limits\b/i, /\bavoid paying\b/i];

function checkTrademarks(manifest: { id: string; display: string; description: string }): string[] {
  const errors: string[] = [];
  const idAndDisplay = `${manifest.id} ${manifest.display}`.toLowerCase();
  for (const platform of BANNED_PLATFORM_NAMES) {
    if (idAndDisplay.includes(platform)) {
      errors.push(`id/display contains the platform name "${platform}" - name it descriptively in description/data_sources instead (CLAUDE.md > Trademarks)`);
    }
  }
  for (const phrase of BANNED_TRADEMARK_PHRASES) {
    if (phrase.test(manifest.description)) {
      errors.push(`description matches banned trademark phrasing "${phrase.source}" (CLAUDE.md > Trademarks)`);
    }
  }
  return errors;
}

// docs/PACKAGES.md's bronze bar, the parts a JSON Schema can't state on
// its own (a minItems:5 on routing.examples already covers that one
// mechanically - kept here too for a friendlier message than Ajv's own).
// docs/PACKAGES.md's "five or more routing examples" describes a
// callable capability being MATCHED against an utterance - true for a
// plugin and a skill (composed into the prompt "when relevant," per its
// own manifest.schema.json kind description) alike, but not for a
// companion (chosen by a household as a persona, never routed to by
// what someone says - found live linting the bundled default/buddy/pal/
// tutor companions, which correctly declare no routing.examples at
// all) or any other declarative kind (app, integration, model,
// wakeword, voice, theme, module). Every other bronze line
// (offline stated, a smoke entry, README/CHANGELOG/quality_scale) stays
// universal - docs/PACKAGES.md states those with no kind qualifier.
const ROUTED_KINDS = new Set(["plugin", "skill"]);

function checkBronzeCompleteness(
  kind: string,
  manifest: {
    routing?: { examples?: string[] };
    permissions?: string[];
    data_sources?: unknown[];
    offline?: string;
    smoke?: unknown;
  },
): string[] {
  const errors: string[] = [];
  if (ROUTED_KINDS.has(kind) && (manifest.routing?.examples?.length ?? 0) < 5) {
    errors.push("routing.examples needs 5 or more entries (docs/PACKAGES.md's bronze bar)");
  }
  const declaresNet = (manifest.permissions ?? []).some((p) => p.startsWith("net:"));
  if (declaresNet && (manifest.data_sources?.length ?? 0) === 0) {
    errors.push("declares a net: permission but no data_sources[] row - every network destination needs a privacy row");
  }
  if (!manifest.offline) errors.push("offline behavior is not stated");
  if (!manifest.smoke) errors.push("no smoke entry declared");
  return errors;
}

export function lintPackage(dir: string): LintResult {
  const errors: string[] = [];
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) return fail([`no manifest.json in ${dir}`]);

  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch (err) {
    return fail([`manifest.json is not valid JSON: ${(err as Error).message}`]);
  }

  if (!validateManifest(manifest)) {
    for (const err of validateManifest.errors ?? []) {
      errors.push(`manifest.json ${err.instancePath || "(root)"}: ${err.message}`);
    }
  }
  // A schema failure doesn't stop the friendlier checks below from also
  // running (both reported together, e.g. Ajv's own "must NOT have fewer
  // than 5 items" alongside this file's plainer "5 or more" message) - the
  // one thing it DOES need to survive is a manifest that parsed as valid
  // JSON but isn't even an object (a bare string or number), which every
  // check below would otherwise crash accessing a property of.
  if (typeof manifest !== "object" || manifest === null) {
    return fail(errors);
  }

  const m = manifest as {
    id: string;
    kind: string;
    display: string;
    description: string;
    tier: number;
    routing?: { examples?: string[] };
    permissions?: string[];
    data_sources?: unknown[];
    offline?: string;
    smoke?: unknown;
  };

  errors.push(...checkTrademarks(m));
  errors.push(...checkBronzeCompleteness(m.kind, m));

  if (m.kind === "skill") {
    // A skill has no recipe at all (plain instructions, never executed
    // standalone - lib/skills.ts's own loadSkill(), never
    // lib/plugins.ts's loadPackage()); SKILL.md is its one real body.
    if (!existsSync(join(dir, "SKILL.md"))) errors.push("kind: skill but no SKILL.md");
  } else if (m.kind !== "plugin") {
    // Every other declarative kind (companion, app, integration, model,
    // wakeword, voice, theme, module) has no recipe or handler.ts at
    // all - found live linting the bundled default/buddy/pal/tutor
    // companions, loaded only through lib/persona.ts's own
    // loadManifestOnly(), never lib/plugins.ts's loadPackage()/
    // runPlugin(). Nothing to check here yet; each kind's own real
    // definition of done is that kind owner's call, not this linter's
    // to invent.
  } else if (m.tier === 0) {
    const recipePath = join(dir, "recipe.json");
    if (!existsSync(recipePath)) {
      errors.push("tier 0 but no recipe.json");
    } else {
      let recipe: unknown;
      try {
        recipe = JSON.parse(readFileSync(recipePath, "utf-8"));
      } catch (err) {
        errors.push(`recipe.json is not valid JSON: ${(err as Error).message}`);
        recipe = undefined;
      }
      if (recipe !== undefined && !validateRecipe(recipe)) {
        for (const err of validateRecipe.errors ?? []) {
          errors.push(`recipe.json ${err.instancePath || "(root)"}: ${err.message}`);
        }
      }
    }
  } else if (m.tier === 1) {
    const entryPath = join(dir, "handler.ts");
    if (!existsSync(entryPath)) errors.push("tier 1 but no handler.ts (the fixed entrypoint convention, lib/denoHost.ts)");
  }

  if (!existsSync(join(dir, "README.md"))) errors.push("no README.md (the store card)");
  if (!existsSync(join(dir, "CHANGELOG.md"))) errors.push("no CHANGELOG.md");
  if (!existsSync(join(dir, "quality_scale.yaml"))) errors.push("no quality_scale.yaml");

  return fail(errors);
}
