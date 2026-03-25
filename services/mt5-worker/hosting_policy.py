from __future__ import annotations

from typing import Any


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _normalize_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    normalized = value.strip()
    return normalized or None


def _normalize_upper(value: Any) -> str | None:
    normalized = _normalize_string(value)
    return normalized.upper() if normalized else None


def _normalize_lower(value: Any) -> str | None:
    normalized = _normalize_string(value)
    return normalized.lower() if normalized else None


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    values: list[str] = []
    for entry in value:
        normalized = _normalize_string(entry)
        if normalized:
            values.append(normalized)

    return values


def _derive_region_group(config: Any) -> str | None:
    if config.host_region_group:
        return config.host_region_group

    country = (config.host_country_code or "").upper()
    if country in {"CA", "US", "MX"}:
        return "north-america"
    if country in {
        "AR",
        "BO",
        "BR",
        "CL",
        "CO",
        "EC",
        "GY",
        "PE",
        "PY",
        "SR",
        "UY",
        "VE",
    }:
        return "south-america"
    if country in {
        "GB",
        "IE",
        "FR",
        "DE",
        "NL",
        "ES",
        "IT",
        "PT",
        "PL",
        "CZ",
        "AT",
        "CH",
        "SE",
        "NO",
        "DK",
        "FI",
        "RO",
        "HU",
        "GR",
    }:
        return "europe"
    if country in {"AU", "NZ"}:
        return "oceania"
    if country in {"AE", "QA", "KW", "SA", "ZA", "NG", "KE", "EG", "MA"}:
        return "middle-east-africa"

    timezone = config.host_timezone or ""
    if timezone.startswith("Europe/"):
        return "europe"
    if timezone.startswith("America/"):
        return "north-america"
    if timezone.startswith("Australia/") or timezone == "Pacific/Auckland":
        return "oceania"
    if timezone.startswith("Africa/"):
        return "middle-east-africa"
    if timezone.startswith("Asia/"):
        return "asia"

    return None


def build_worker_host_policy_meta(config: Any) -> dict[str, Any]:
    device_identity_key = (
        f"device:{config.device_profile_id}"
        if getattr(config, "device_profile_id", None)
        else f"host:{config.host_id}"
    )
    payload: dict[str, Any] = {
        "hostId": config.host_id,
        "workerId": config.worker_id,
        "hostRegion": config.host_region,
        "hostRegionGroup": _derive_region_group(config),
        "hostCountryCode": config.host_country_code,
        "hostCity": config.host_city,
        "hostTimezone": config.host_timezone,
        "hostTags": sorted(set(config.host_tags)),
        "deviceIsolationMode": config.device_isolation_mode,
        "deviceIdentityKey": device_identity_key,
    }

    if config.host_public_ip:
        payload["publicIp"] = config.host_public_ip
    if config.reserved_user_id:
        payload["reservedUserId"] = config.reserved_user_id
    if getattr(config, "device_profile_id", None):
        payload["deviceProfileId"] = config.device_profile_id

    return payload


def validate_connection_host_policy(
    config: Any,
    bootstrap: dict[str, Any],
) -> dict[str, Any] | None:
    meta = _as_dict(bootstrap.get("meta"))
    hosting = _as_dict(meta.get("mt5Hosting"))
    if not hosting:
        return None

    reasons: list[str] = []
    sticky_host_id = _normalize_string(hosting.get("stickyHostId"))
    if sticky_host_id and sticky_host_id != config.host_id:
        reasons.append("sticky-host-mismatch")

    required_host_tags = set(_string_list(hosting.get("requiredHostTags")))
    host_tags = set(config.host_tags)
    missing_tags = sorted(tag for tag in required_host_tags if tag not in host_tags)
    if missing_tags:
        reasons.append("missing-host-tags")

    geo_enforcement = _normalize_lower(hosting.get("geoEnforcement")) or "strict"
    preferred_host_countries = {
        country
        for country in (
            _normalize_upper(entry)
            for entry in _string_list(hosting.get("preferredHostCountries"))
        )
        if country
    }
    if preferred_host_countries:
        if not config.host_country_code and geo_enforcement == "strict":
            reasons.append("host-country-unknown")
        elif (
            geo_enforcement == "strict"
            and config.host_country_code
            and config.host_country_code.upper() not in preferred_host_countries
        ):
            reasons.append("country-mismatch")

    preferred_region_groups = {
        region
        for region in (
            _normalize_lower(entry)
            for entry in _string_list(hosting.get("preferredRegionGroups"))
        )
        if region
    }
    if preferred_region_groups:
        resolved_region_group = _derive_region_group(config)
        current_region_group = resolved_region_group.lower() if resolved_region_group else None
        if not current_region_group and geo_enforcement == "strict":
            reasons.append("host-region-group-unknown")
        elif (
            geo_enforcement == "strict"
            and current_region_group
            and current_region_group not in preferred_region_groups
        ):
            reasons.append("region-group-mismatch")

    if reasons:
        return {
            "phase": "sleeping",
            "sleepReason": "host_policy_mismatch",
            "policyVersion": hosting.get("version"),
            "stickyHostId": sticky_host_id,
            "requiredHostTags": sorted(required_host_tags),
            "preferredHostCountries": sorted(preferred_host_countries),
            "preferredRegionGroups": sorted(preferred_region_groups),
            "hostPolicyReasons": reasons,
            **build_worker_host_policy_meta(config),
        }

    return None
