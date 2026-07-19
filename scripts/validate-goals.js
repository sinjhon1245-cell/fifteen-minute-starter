/* 데이터 무결성 검증 스크립트 (브라우저 콘솔 또는 test/validate.html 에서 실행) */
(function (global) {
  'use strict';

  function validate(categories, goals) {
    var errors = [];
    var warnings = [];
    var stepIds = Object.create(null);
    var goalIds = Object.create(null);

    if (categories.length !== 8) {
      errors.push('분야 수가 8개가 아닙니다: ' + categories.length);
    }

    if (goals.length < 16) {
      errors.push('목표 수가 16개 미만입니다: ' + goals.length);
    }

    var totalSteps = 0;
    var categoryIds = categories.map(function (c) { return c.id; });

    goals.forEach(function (g) {
      if (goalIds[g.id]) {
        errors.push('중복된 목표 ID: ' + g.id);
      }
      goalIds[g.id] = true;

      ['id', 'categoryId', 'title', 'description', 'startMessage'].forEach(function (field) {
        if (!g[field] || String(g[field]).trim() === '') {
          errors.push('목표 ' + g.id + '의 필드 ' + field + '가 비어 있습니다.');
        }
      });

      if (categoryIds.indexOf(g.categoryId) === -1) {
        errors.push('목표 ' + g.id + '의 categoryId(' + g.categoryId + ')가 유효한 분야가 아닙니다.');
      }

      if (!g.steps || g.steps.length < 4) {
        errors.push('목표 ' + g.id + '의 단계 수가 4개 미만입니다: ' + (g.steps ? g.steps.length : 0));
      }
      if (g.steps && g.steps.length > 6) {
        warnings.push('목표 ' + g.id + '의 단계 수가 6개를 초과합니다: ' + g.steps.length);
      }

      (g.steps || []).forEach(function (s) {
        totalSteps += 1;
        if (stepIds[s.id]) {
          errors.push('중복된 단계 ID: ' + s.id);
        }
        stepIds[s.id] = true;

        ['id', 'title', 'action', 'preparation', 'focusMessage', 'fallbackAction', 'finishAction', 'nextPreview'].forEach(function (field) {
          if (!s[field] || String(s[field]).trim() === '') {
            errors.push('단계 ' + s.id + '의 필드 ' + field + '가 비어 있습니다.');
          }
        });

        if (typeof s.stepNumber !== 'number' || s.stepNumber < 1) {
          errors.push('단계 ' + s.id + '의 stepNumber가 올바르지 않습니다.');
        }
      });
    });

    if (totalSteps < 70) {
      errors.push('전체 단계 수가 70개 미만입니다: ' + totalSteps);
    }
    if (totalSteps > 90) {
      warnings.push('전체 단계 수가 90개를 초과합니다: ' + totalSteps);
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      stats: {
        categories: categories.length,
        goals: goals.length,
        totalSteps: totalSteps
      }
    };
  }

  global.FMS_ValidateGoals = validate;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = validate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
