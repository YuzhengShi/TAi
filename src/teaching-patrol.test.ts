import { describe, it, expect, beforeEach, vi } from 'vitest';

import { _initTestDatabase, createTask, getAllTasks } from './db.js';
import { hasPatrolTask, seedTeachingPatrol } from './teaching-patrol.js';
import type { RegisteredGroup } from './types.js';

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const STUDENT_GROUP: RegisteredGroup = {
  name: 'Yuzheng',
  folder: 'yuzheng',
  trigger: '@TAi',
  added_at: '2026-01-01T00:00:00.000Z',
};

const MAIN_GROUP: RegisteredGroup = {
  name: 'Admin',
  folder: 'main',
  trigger: 'always',
  added_at: '2026-01-01T00:00:00.000Z',
};

describe('teaching-patrol', () => {
  beforeEach(() => {
    _initTestDatabase();
  });

  describe('hasPatrolTask', () => {
    it('returns false when no tasks exist', () => {
      expect(hasPatrolTask('yuzheng')).toBe(false);
    });

    it('returns true when a patrol task exists', () => {
      createTask({
        id: 'patrol-yuzheng-1',
        group_folder: 'yuzheng',
        chat_jid: 'test@g.us',
        prompt: '[TEACHING_PATROL]\nDo the patrol',
        schedule_type: 'cron',
        schedule_value: '0 9 * * 1-5',
        context_mode: 'group',
        next_run: new Date().toISOString(),
        status: 'active',
        created_at: new Date().toISOString(),
      });

      expect(hasPatrolTask('yuzheng')).toBe(true);
    });

    it('returns false for paused patrol tasks', () => {
      createTask({
        id: 'patrol-yuzheng-1',
        group_folder: 'yuzheng',
        chat_jid: 'test@g.us',
        prompt: '[TEACHING_PATROL]\nDo the patrol',
        schedule_type: 'cron',
        schedule_value: '0 9 * * 1-5',
        context_mode: 'group',
        next_run: new Date().toISOString(),
        status: 'paused',
        created_at: new Date().toISOString(),
      });

      expect(hasPatrolTask('yuzheng')).toBe(false);
    });

    it('returns false for non-patrol tasks', () => {
      createTask({
        id: 'task-1',
        group_folder: 'yuzheng',
        chat_jid: 'test@g.us',
        prompt: 'Send a reminder',
        schedule_type: 'cron',
        schedule_value: '0 9 * * 1-5',
        context_mode: 'group',
        next_run: new Date().toISOString(),
        status: 'active',
        created_at: new Date().toISOString(),
      });

      expect(hasPatrolTask('yuzheng')).toBe(false);
    });
  });

  describe('seedTeachingPatrol', () => {
    it('creates patrol tasks for student groups', () => {
      const groups: Record<string, RegisteredGroup> = {
        'main@g.us': MAIN_GROUP,
        'yuzheng@g.us': STUDENT_GROUP,
      };

      seedTeachingPatrol(groups);

      const tasks = getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].group_folder).toBe('yuzheng');
      expect(tasks[0].prompt).toContain('[TEACHING_PATROL]');
      expect(tasks[0].schedule_type).toBe('cron');
      expect(tasks[0].schedule_value).toBe('0 9 * * 1-5');
      expect(tasks[0].context_mode).toBe('group');
      expect(tasks[0].status).toBe('active');
    });

    it('skips the main group', () => {
      const groups: Record<string, RegisteredGroup> = {
        'main@g.us': MAIN_GROUP,
      };

      seedTeachingPatrol(groups);

      expect(getAllTasks()).toHaveLength(0);
    });

    it('does not duplicate patrol tasks', () => {
      const groups: Record<string, RegisteredGroup> = {
        'yuzheng@g.us': STUDENT_GROUP,
      };

      seedTeachingPatrol(groups);
      seedTeachingPatrol(groups);

      expect(getAllTasks()).toHaveLength(1);
    });

    it('seeds for multiple student groups', () => {
      const groups: Record<string, RegisteredGroup> = {
        'main@g.us': MAIN_GROUP,
        'yuzheng@g.us': STUDENT_GROUP,
        'wu-hao@g.us': {
          name: 'Wu Hao',
          folder: 'wu-hao',
          trigger: '@TAi',
          added_at: '2026-01-01T00:00:00.000Z',
        },
      };

      seedTeachingPatrol(groups);

      const tasks = getAllTasks();
      expect(tasks).toHaveLength(2);
      const folders = tasks.map((t) => t.group_folder).sort();
      expect(folders).toEqual(['wu-hao', 'yuzheng']);
    });
  });
});
