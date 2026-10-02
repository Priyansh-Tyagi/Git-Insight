import { describe, it, expect } from 'vitest';
import { aggregateByCategory } from '../services/skills/aggregateByCategory';
import { SkillResult } from '../services/skills/inferSkills';

function makeSkill(overrides: Partial<SkillResult>): SkillResult {
  return {
    skill: 'x',
    category: 'Frontend',
    strengthScore: 50,
    trend: 'stable',
    repoCount: 1,
    evidenceRepoIds: [],
    ...overrides,
  };
}

describe('aggregateByCategory', () => {
  it('averages scores within the same category', () => {
    const skills = [
      makeSkill({ skill: 'JavaScript', category: 'Frontend', strengthScore: 80 }),
      makeSkill({ skill: 'TypeScript', category: 'Frontend', strengthScore: 60 }),
    ];
    const result = aggregateByCategory(skills);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Frontend');
    expect(result[0].averageScore).toBe(70);
    expect(result[0].skillCount).toBe(2);
  });

  it('keeps categories separate', () => {
    const skills = [
      makeSkill({ skill: 'Python', category: 'Backend', strengthScore: 90 }),
      makeSkill({ skill: 'Docker', category: 'DevOps', strengthScore: 40 }),
    ];
    const result = aggregateByCategory(skills);
    expect(result).toHaveLength(2);
  });

  it('sorts categories by average score descending', () => {
    const skills = [
      makeSkill({ skill: 'A', category: 'Weak', strengthScore: 20 }),
      makeSkill({ skill: 'B', category: 'Strong', strengthScore: 90 }),
    ];
    const result = aggregateByCategory(skills);
    expect(result[0].category).toBe('Strong');
    expect(result[1].category).toBe('Weak');
  });

  it('returns an empty array for no skills', () => {
    expect(aggregateByCategory([])).toEqual([]);
  });
});
