"""
Constraint validation utilities for the optimization engine.
Provides standalone validation functions that can be called independently
of the solver to verify solution quality.
"""
from typing import List, Tuple
from app.models.battery import BatteryConfig
from app.models.optimization import DispatchStep, ConstraintStatus


def validate_soc_transition(
    soc_before: float,
    soc_after: float,
    charge_power_mw: float,
    discharge_power_mw: float,
    config: BatteryConfig,
    dt_hours: float = 1.0,
    tolerance: float = 1e-3
) -> Tuple[bool, str]:
    """
    Verify that a SoC transition is physically consistent.

    Returns:
        (is_valid, error_message)
    """
    expected_soc = soc_before + (
        config.efficiency_charge * charge_power_mw
        - discharge_power_mw / config.efficiency_discharge
    ) * dt_hours / config.capacity_mwh

    error = abs(expected_soc - soc_after)
    if error > tolerance:
        return False, f"SoC transition error: expected {expected_soc:.4f}, got {soc_after:.4f} (error={error:.6f})"
    return True, ""


def validate_full_dispatch(
    dispatch: List[DispatchStep],
    config: BatteryConfig,
    dt_hours: float = 1.0,
) -> ConstraintStatus:
    """
    Comprehensive post-solve constraint validation.

    Checks:
    1. SoC within bounds at every step
    2. Power limits respected
    3. No simultaneous charge/discharge
    4. SoC transitions are physically consistent
    5. No NaN values
    6. Final SoC meets terminal requirement
    """
    violations = []
    tol = 1e-3

    for step in dispatch:
        t = step.step

        # Check for NaN
        for field, val in [
            ("soc_start", step.soc_start), ("soc_end", step.soc_end),
            ("charge_power_mw", step.charge_power_mw),
            ("discharge_power_mw", step.discharge_power_mw),
        ]:
            import math
            if math.isnan(val):
                violations.append(f"Step {t}: NaN in {field}")

        # SoC bounds
        if step.soc_end < config.soc_min - tol:
            violations.append(
                f"Step {t}: SoC end {step.soc_end:.4f} < SoC min {config.soc_min:.4f}"
            )
        if step.soc_end > config.soc_max + tol:
            violations.append(
                f"Step {t}: SoC end {step.soc_end:.4f} > SoC max {config.soc_max:.4f}"
            )

        # Power limits
        if step.charge_power_mw > config.power_mw + tol:
            violations.append(
                f"Step {t}: Charge power {step.charge_power_mw:.3f} MW exceeds limit {config.power_mw:.3f} MW"
            )
        if step.discharge_power_mw > config.power_mw + tol:
            violations.append(
                f"Step {t}: Discharge power {step.discharge_power_mw:.3f} MW exceeds limit {config.power_mw:.3f} MW"
            )

        # Anti-simultaneity
        if step.charge_power_mw > tol and step.discharge_power_mw > tol:
            violations.append(
                f"Step {t}: Simultaneous charge ({step.charge_power_mw:.3f}) and discharge "
                f"({step.discharge_power_mw:.3f}) detected"
            )

        # Physical SoC consistency
        valid, msg = validate_soc_transition(
            soc_before=step.soc_start,
            soc_after=step.soc_end,
            charge_power_mw=step.charge_power_mw,
            discharge_power_mw=step.discharge_power_mw,
            config=config,
            dt_hours=dt_hours,
        )
        if not valid:
            violations.append(f"Step {t}: {msg}")

    # Terminal SoC
    if dispatch and config.soc_terminal is not None:
        final_soc = dispatch[-1].soc_end
        if final_soc < config.soc_terminal - tol:
            violations.append(
                f"Terminal SoC {final_soc:.4f} below required {config.soc_terminal:.4f}"
            )

    passed = len(violations) == 0
    return ConstraintStatus(
        passed=passed,
        violations=len(violations),
        details=violations[:20]
    )
