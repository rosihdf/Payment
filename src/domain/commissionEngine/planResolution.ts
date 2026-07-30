import type { CommissionPlanVersion } from '../commission/commissionPlan';
import type { SalesRepresentativeCommissionAssignment } from '../commission/commissionAssignment';
import {
  COMMISSION_FINDING_CODES,
  createCommissionFinding,
  type CommissionFinding,
} from '../commission/commissionFinding';

function parseDate(value: string): Date | null {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isCommissionPlanVersionValidOnDate(
  version: CommissionPlanVersion,
  evaluationDate: string,
): boolean {
  if (version.status !== 'published') {
    return false;
  }

  const date = parseDate(evaluationDate);
  const validFrom = parseDate(version.validFrom);
  if (!date || !validFrom || date < validFrom) {
    return false;
  }

  if (version.validUntil) {
    const validUntil = parseDate(version.validUntil);
    if (!validUntil || date > validUntil) {
      return false;
    }
  }

  return true;
}

export interface CommissionPlanResolution {
  assignment: SalesRepresentativeCommissionAssignment | null;
  planVersion: CommissionPlanVersion | null;
  findings: CommissionFinding[];
}

export function resolveCommissionPlanAssignment(
  assignments: SalesRepresentativeCommissionAssignment[],
  planVersions: CommissionPlanVersion[],
  salesRepresentativeId: string,
  evaluationDate: string,
): CommissionPlanResolution {
  const findings: CommissionFinding[] = [];
  const date = parseDate(evaluationDate);
  if (!date) {
    findings.push(
      createCommissionFinding({
        code: COMMISSION_FINDING_CODES.COMMISSION_INPUT_MISSING,
        severity: 'blocking',
        category: 'calculation',
        field: 'evaluationDate',
        ruleId: null,
        blocking: true,
        internalDescription: 'Ungültiger Berechnungsstichtag.',
        salesDescription: 'Der Berechnungsstichtag ist ungültig.',
        requiredAction: 'Stichtag prüfen',
      }),
    );
    return { assignment: null, planVersion: null, findings };
  }

  const candidates = assignments.filter((assignment) => {
    if (
      assignment.salesRepresentativeId !== salesRepresentativeId ||
      assignment.status !== 'active' ||
      !assignment.isPrimary
    ) {
      return false;
    }

    const validFrom = parseDate(assignment.validFrom);
    if (!validFrom || date < validFrom) {
      return false;
    }

    if (assignment.validUntil) {
      const validUntil = parseDate(assignment.validUntil);
      if (!validUntil || date > validUntil) {
        return false;
      }
    }

    return true;
  });

  if (candidates.length === 0) {
    findings.push(
      createCommissionFinding({
        code: COMMISSION_FINDING_CODES.COMMISSION_PLAN_NOT_FOUND,
        severity: 'blocking',
        category: 'assignment',
        field: 'salesRepresentativeId',
        ruleId: null,
        blocking: true,
        internalDescription: 'Keine gültige primäre Provisionsplanzuordnung am Stichtag.',
        salesDescription: 'Für Sie ist kein gültiger Provisionsplan hinterlegt.',
        requiredAction: 'Admin kontaktieren',
      }),
    );
    return { assignment: null, planVersion: null, findings };
  }

  if (candidates.length > 1) {
    findings.push(
      createCommissionFinding({
        code: COMMISSION_FINDING_CODES.COMMISSION_PLAN_ASSIGNMENT_AMBIGUOUS,
        severity: 'blocking',
        category: 'assignment',
        field: 'salesRepresentativeId',
        ruleId: null,
        blocking: true,
        internalDescription: 'Mehrere überlappende primäre Provisionsplanzuordnungen.',
        salesDescription: 'Die Provisionsplanzuordnung ist nicht eindeutig.',
        requiredAction: 'Admin kontaktieren',
      }),
    );
    return { assignment: null, planVersion: null, findings };
  }

  const assignment = candidates[0]!;
  const matchingVersions = planVersions.filter(
    (version) =>
      version.id === assignment.commissionPlanVersionId &&
      isCommissionPlanVersionValidOnDate(version, evaluationDate),
  );

  if (matchingVersions.length !== 1) {
    findings.push(
      createCommissionFinding({
        code: COMMISSION_FINDING_CODES.COMMISSION_PLAN_NOT_PUBLISHED,
        severity: 'blocking',
        category: 'plan',
        field: null,
        ruleId: null,
        blocking: true,
        internalDescription: 'Die zugeordnete Provisionsplanversion ist am Stichtag nicht veröffentlicht.',
        salesDescription: 'Der Provisionsplan ist am Stichtag nicht gültig.',
        requiredAction: 'Admin kontaktieren',
      }),
    );
    return { assignment, planVersion: null, findings };
  }

  return { assignment, planVersion: matchingVersions[0]!, findings };
}
