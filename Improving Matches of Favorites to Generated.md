Improving Matches of Favorites to Generated Icons.

Below is a tight, production-ready solution.

✅ The Core Idea

Your wrapper prompt must summarize the visual DNA of the favorites and then enforce it on the generated icon.

To do this, you generate a Style Summary Block from the Favorites → inject it into every generation prompt.

This is the same pattern as “image-based style transfer,” but done with language.

🎯 OUTPUT: Production-Ready Wrapper Prompt

Below is the exact wrapper prompt I recommend your system construct dynamically:

WRAPPER PROMPT (for Nano Banana Pro)

You are generating a new icon that must perfectly match the visual style of the reference set below.

—
REFERENCE ICON STYLE (auto-generated from Favorites):
• Stroke weight: {avgStroke}px
• Stroke style: {outline|filled|duotone|mixed}
• Stroke caps: {rounded|square}
• Stroke joins: {rounded|mitered}
• Corner radius: {avgCorner}px
• Fill usage: {none|solid|partial}
• Geometry: {circular|squircular|square|angular|mixed}
• Detail level: very minimal / simplified / no internal micro-details
• Proportions: {square canvas, centered composition}
• Negative space: intentionally used for clarity

REFERENCE ICONS PROVIDED:
{embed favorites as images or as descriptions; either works}

—
TASK:
Generate a simple vector icon representing:
“{USER_PROMPT}”

STRICT RULES:
• The new icon must look like it belongs in the same set as the reference icons.
• Use identical stroke weight and geometry style.
• No shading, no gradients, no textures.
• No fine details, text, or realism.
• Use the minimal number of shapes needed.
• Must remain readable at 24px.

OUTPUT:
• Clean, centered white icon on transparent background
• Thick enough strokes to survive vectorization
• No drop shadows, no lighting effects
• Export as a single solid vector shape group

—
Now generate 4 variations.

🧠 Step 1 — Auto-generate the Style Summary Block

You already have SVGs in Favorites.

Your system should inspect these automatically:

Measure/Infer:

stroke width (parse SVG stroke-width)

corner radius (parse rx, distortions)

stroke caps (rounded vs butt vs square)

overall geometry (circular vs rectangular)

fill mode (outline vs solid)

detail density (number of paths)

aspect ratio

negative space ratio

If you can’t parse, you can also do visual inference by feeding favorites into the image model and asking:

“Describe the common visual style across these 8 icons.”

But programmatic parsing is more reliable.

🧬 Step 2 — Insert that into the wrapper prompt

Your system will auto-populate:

avgStroke = 2.4
cornerRadius = 3
strokeStyle = outline
geometry = circular
detailLevel = minimal
caps = rounded


All derived from real icons.

This is the part that will finally make Nano Banana honor style constraints.

🧪 Step 3 — Use “strict rules” to kill off unwanted detail

The following constraints MUST be included:

Block fine detail
Avoid any internal micro-details such as window lines, text, rivets, thin decorations, or textures.

Force geometric simplification
Use simple geometric primitives only: circles, rectangles, and basic curves.

Kill perspective
No perspective, no 3D tilt, no depth. Use flat orthographic projection only.

Force minimalism
Maximum 2–4 shapes total.

🔥 Example: Battery with Lightning Bolt

User input prompt:

battery with a lightning bolt


System-generated wrapper prompt:

Task: Create a simple vector icon of a “battery with lightning bolt.”
Follow these strict style constraints derived from the workspace’s reference icons:

Stroke weight: 2px
Caps: rounded
Style: outline
Corner radius: 3px
Detail level: extremely minimal
Geometry: mostly rounded rectangles + circles

Do not add fine detail. Do not add inner shapes other than a single simplified bolt.

Output clean white icon on transparent background. Vector-friendly.

This will produce icons that look like your library’s chat bubble set, not random clip-art.

🏆 This gets you:

✔ Icons that finally match your brand/library
✔ Stroke-perfect consistency
✔ Minimalist, production-ready shapes
✔ Stable and predictable output
✔ No fine-detail noise
✔ Smooth SVG conversion