/**
 * Class Promotion Logic
 * Handles intelligent class promotion based on levelCount
 * 
 * Example:
 * - MTS 1B, levelCount=3 → MTS 2B (naik tingkat dalam level)
 * - MTS 3B, levelCount=3 → MA 4B (pindah level, karena tingkat sudah max)
 */

export interface ClassInfo {
  levelCode: string;  // e.g., "MTS"
  levelNumber: number; // e.g., 1 (untuk MTS 1B)
  classChar: string;   // e.g., "B"
  fullName: string;    // e.g., "MTS 1B"
}

export interface LevelInfo {
  code: string;
  levelCount: number;
  order: number;
}

export interface NextClassInfo {
  nextLevelCode: string;
  nextClassNumber: number;
  promotionType: 'SAME_LEVEL' | 'NEXT_LEVEL';
}

/**
 * Parse class name to extract just the number and character
 * Examples:
 * - "1B" → { levelNumber: 1, classChar: "B" }
 * - "3A" → { levelNumber: 3, classChar: "A" }
 * - "4B" → { levelNumber: 4, classChar: "B" }
 */
export function parseClassName(className: string): ClassInfo | null {
  // Try format: "LEVEL NUMBERCHAR" (e.g., "MTS 1B")
  let match = className.match(/^([A-Z]+)\s+(\d+)([A-Z])$/);
  if (match) {
    return {
      levelCode: match[1],
      levelNumber: parseInt(match[2]),
      classChar: match[3],
      fullName: className,
    };
  }

  // Try format: "NUMBERCHAR" (e.g., "1B") - extract just number and char
  match = className.match(/^(\d+)([A-Z])$/);
  if (match) {
    return {
      levelCode: '', // Will be filled from level code in caller
      levelNumber: parseInt(match[1]),
      classChar: match[2],
      fullName: className,
    };
  }

  return null;
}

export function buildClassName(levelCode: string, classNumber: number, classChar: string) {
  return `${levelCode} ${classNumber}${classChar}`;
}

export function matchesClassIdentity(
  className: string,
  expectedLevelCode: string,
  expectedClassNumber: number,
  expectedClassChar: string
) {
  const parsed = parseClassName(className);
  if (!parsed) return false;

  const levelCodeMatches = !parsed.levelCode || parsed.levelCode === expectedLevelCode;
  return (
    levelCodeMatches &&
    parsed.levelNumber === expectedClassNumber &&
    parsed.classChar === expectedClassChar
  );
}

/**
 * Calculate the next class number within the same level or find next level
 * 
 * @param currentClass Parsed current class info
 * @param currentLevel Current level with levelCount
 * @param nextLevel Next level (if promoting to new level)
 * @returns { nextLevelCode, nextClassNumber, promotionType } or null if cannot promote
 * 
 * IMPORTANT: If the current level has a configured levelCount, the system
 * promotes within the same level until that count is reached, then rolls over
 * to the next level. If levelCount is missing or zero, it stays in the same level.
 */
export function calculateNextClass(
  currentClass: ClassInfo,
  currentLevel: LevelInfo,
  nextLevel: Pick<LevelInfo, 'code' | 'order' | 'levelCount'> | null = null
): NextClassInfo | null {
  const nextClassNumber = currentClass.levelNumber + 1;

  if (currentLevel.levelCount > 0 && currentClass.levelNumber >= currentLevel.levelCount) {
    if (!nextLevel) return null;

    return {
      nextLevelCode: nextLevel.code,
      nextClassNumber,
      promotionType: 'NEXT_LEVEL',
    };
  }

  return {
    nextLevelCode: currentLevel.code,
    nextClassNumber,
    promotionType: 'SAME_LEVEL',
  };
}

/**
 * Find target class by level code and number
 * 
 * @param classes Array of available classes
 * @param levelCode Level code (e.g., "MTS", "MA")
 * @param classNumber Class number (e.g., 1, 2, 3, 4, 5, 6)
 * @param classChar Class character (e.g., "A", "B", "C")
 * @returns Found class or null
 */
export function findTargetClass(
  classes: Array<{ id: string; name: string; levelId: string }>,
  levelCode: string,
  classNumber: number,
  classChar: string
): { id: string; name: string; levelId: string } | null {
  const targetName = `${levelCode} ${classNumber}${classChar}`;
  return classes.find((c) => c.name === targetName) || null;
}

/**
 * Get all possible target classes for a given source class
 * (useful for fallback/selection if auto-target not found)
 */
export function getPossibleTargetClasses(
  sourceClass: ClassInfo,
  currentLevel: LevelInfo,
  nextLevel: LevelInfo | null,
  classes: Array<{ id: string; name: string; levelId: string }>
) {
  const next = calculateNextClass(sourceClass, currentLevel, nextLevel);
  if (!next) return [];
  
  // Return classes matching the next level and possible numbers
  return classes.filter((c) => {
    return matchesClassIdentity(
      c.name,
      next.nextLevelCode,
      next.nextClassNumber,
      sourceClass.classChar
    );
  });
}
