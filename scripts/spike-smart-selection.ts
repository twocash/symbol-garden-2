/**
 * Spike: Test trait-aware exemplar selection improvements
 *
 * Tests:
 * 1. Trait-aware selection vs basic selection for different concepts
 * 2. Rich context formatting with aiMetadata
 * 3. Semantic guidance in decomposition
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { Icon } from '../src/types/schema';
import {
  findExemplarIcons,
  findExemplarIconsWithTraits,
  getConceptHints,
  formatIconWithContext,
  formatSimilarIconsWithContext,
} from '../src/lib/similar-icon-finder';
import { generateIcon, GenerationConfig } from '../src/lib/hybrid-generator';

async function main() {
  console.log('🧪 Testing Trait-Aware Exemplar Selection\n');
  console.log('='.repeat(60));

  // Load Feather icons
  const featherData = JSON.parse(fs.readFileSync('data/feather-icons.json', 'utf-8'));
  const icons: Icon[] = Array.isArray(featherData) ? featherData : featherData.icons || [];

  console.log(`✓ Loaded ${icons.length} icons`);

  // Check enrichment status
  const enrichedCount = icons.filter(i => i.aiMetadata).length;
  console.log(`✓ ${enrichedCount} icons have aiMetadata enrichment (${((enrichedCount / icons.length) * 100).toFixed(1)}%)\n`);

  // Test concepts with known trait expectations
  const testConcepts = [
    { concept: 'rocket', expectedTraits: ['symmetry'], expectedCategory: 'object' },
    { concept: 'brain', expectedTraits: ['compound'], expectedCategory: 'object' },
    { concept: 'scissors', expectedTraits: ['intersection', 'symmetry'], expectedCategory: 'object' },
    { concept: 'battery', expectedTraits: ['containment', 'symmetry'], expectedCategory: 'object' },
    { concept: 'network', expectedTraits: ['intersection', 'compound'], expectedCategory: 'abstract' },
  ];

  console.log('## Comparing Selection Methods\n');

  for (const { concept, expectedTraits, expectedCategory } of testConcepts) {
    console.log(`### ${concept.toUpperCase()}`);
    console.log(`Expected: ${expectedCategory}, traits: [${expectedTraits.join(', ')}]\n`);

    // Get concept hints
    const hints = getConceptHints(concept);
    console.log(`Hints detected: ${hints.category || 'none'}, traits: [${hints.traits?.join(', ') || 'none'}]`);

    // Compare selection methods
    const basicExemplars = findExemplarIcons(icons, 4, concept);
    const traitExemplars = findExemplarIconsWithTraits(icons, 4, concept);

    console.log('\nBasic Selection:');
    for (const icon of basicExemplars) {
      const meta = icon.aiMetadata;
      const traits = meta?.geometricTraits?.join(', ') || 'no metadata';
      console.log(`  - ${icon.name}: [${traits}]`);
    }

    console.log('\nTrait-Aware Selection:');
    for (const icon of traitExemplars) {
      const meta = icon.aiMetadata;
      const traits = meta?.geometricTraits?.join(', ') || 'no metadata';
      const matchingTraits = expectedTraits.filter(t => meta?.geometricTraits?.includes(t as any));
      const matchIndicator = matchingTraits.length > 0 ? ` ✓ matches: [${matchingTraits.join(', ')}]` : '';
      console.log(`  - ${icon.name}: [${traits}]${matchIndicator}`);
    }

    // Calculate trait match scores
    const basicMatches = basicExemplars.reduce((sum, icon) => {
      const matchCount = expectedTraits.filter(t => icon.aiMetadata?.geometricTraits?.includes(t as any)).length;
      return sum + matchCount;
    }, 0);

    const traitMatches = traitExemplars.reduce((sum, icon) => {
      const matchCount = expectedTraits.filter(t => icon.aiMetadata?.geometricTraits?.includes(t as any)).length;
      return sum + matchCount;
    }, 0);

    console.log(`\nTrait Match Score: Basic=${basicMatches}, Trait-Aware=${traitMatches}`);
    if (traitMatches > basicMatches) {
      console.log(`  → Trait-aware selection improved matching by ${traitMatches - basicMatches} traits!`);
    }
    console.log('\n' + '-'.repeat(50) + '\n');
  }

  // Test rich context formatting
  console.log('## Rich Context Formatting\n');

  // Find an icon with metadata
  const iconWithMeta = icons.find(i => i.aiMetadata && i.aiDescription);
  if (iconWithMeta) {
    console.log('Example icon with full context:');
    console.log(formatIconWithContext(iconWithMeta));
    console.log();
  }

  // Test a full generation with the new system
  console.log('## Testing Full Generation with Improvements\n');

  const outputDir = path.join(process.cwd(), 'spike-output-smart');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate a concept that benefits from trait-aware selection
  const testConcept = 'rocket';
  console.log(`Generating: ${testConcept}`);

  try {
    const config: GenerationConfig = {
      concept: testConcept,
      library: icons,
      libraryId: 'feather',
      fewShotCount: 4,
      decompositionMode: 'auto',
      temperature: 0.2,
    };

    const result = await generateIcon(config);

    console.log(`\n✓ Generated in ${result.attempts} attempt(s)`);
    console.log(`  Decomposition source: ${result.decompositionSource}`);
    console.log(`  Few-shot examples: ${result.fewShotExamples.join(', ')}`);
    console.log(`  Tokens used: ${result.tokensUsed}`);

    // Save the result
    const outputPath = path.join(outputDir, `${testConcept}.svg`);
    fs.writeFileSync(outputPath, result.svg);
    console.log(`  Saved to: ${outputPath}`);

    // Log decomposition if dynamic
    if (result.decomposition && result.decompositionSource === 'dynamic') {
      console.log(`\n  Decomposition components:`);
      for (const comp of result.decomposition.components) {
        console.log(`    - ${comp.name}: ${comp.description}`);
      }
    }
  } catch (error) {
    console.error('Generation failed:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done!');
}

main().catch(console.error);
