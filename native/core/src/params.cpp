// params.cpp — reading and writing parameter values (params.h).

#include "phuzzbox/params.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace phuzzbox {

double constrain(const ParamInfo &p, double v) {
  if (!std::isfinite(v)) v = p.def;
  v = std::clamp(v, p.min, p.max);
  if (p.kind != ParamKind::continuous) return std::round(v);
  if (p.step > 0) v = std::clamp(p.min + std::round((v - p.min) / p.step) * p.step, p.min, p.max);
  return v;
}

double toNormalized(const ParamInfo &p, double v) {
  v = constrain(p, v);
  if (p.max <= p.min) return 0;
  if (p.log && p.min > 0) return std::log(v / p.min) / std::log(p.max / p.min);
  return (v - p.min) / (p.max - p.min);
}

double fromNormalized(const ParamInfo &p, double x) {
  x = std::clamp(x, 0.0, 1.0);
  const double v = p.log && p.min > 0 ? p.min * std::pow(p.max / p.min, x) : p.min + x * (p.max - p.min);
  return constrain(p, v);
}

void formatValue(const ParamInfo &p, double v, char *out, size_t size) {
  v = constrain(p, v);
  if (p.kind == ParamKind::choice) { std::snprintf(out, size, "%s", p.choices && (int)v < p.choiceCount ? p.choices[(int)v] : "?"); return; }
  if (p.kind == ParamKind::toggle) { std::snprintf(out, size, "%s", v ? "on" : "off"); return; }
  const double shown = v * p.scale;
  char num[64];
  std::snprintf(num, sizeof num, "%.*f", std::max(0, p.decimals), shown);
  if (num[0] == '-' && std::strtod(num, nullptr) == 0) std::memmove(num, num + 1, std::strlen(num)); // no "-0.0"
  if (p.unit && *p.unit) std::snprintf(out, size, "%s %s", num, p.unit);
  else std::snprintf(out, size, "%s", num);
}

bool parseValue(const ParamInfo &p, const char *text, double &v) {
  if (!text) return false;
  while (*text == ' ') text++;
  if (p.kind == ParamKind::choice) {
    for (int i = 0; i < p.choiceCount; i++) if (!std::strcmp(text, p.choices[i])) { v = i; return true; }
  }
  if (p.kind == ParamKind::toggle) {
    if (!std::strcmp(text, "on")) { v = 1; return true; }
    if (!std::strcmp(text, "off")) { v = 0; return true; }
  }
  // "−" (U+2212) as a minus
  char buf[64];
  size_t j = 0;
  for (const char *s = text; *s && j < sizeof buf - 1; s++) {
    if ((unsigned char)s[0] == 0xE2 && (unsigned char)s[1] == 0x88 && (unsigned char)s[2] == 0x92) { buf[j++] = '-'; s += 2; }
    else buf[j++] = *s;
  }
  buf[j] = 0;
  char *end = nullptr;
  const double x = std::strtod(buf, &end);
  if (end == buf || !std::isfinite(x)) return false;
  v = constrain(p, p.kind == ParamKind::continuous && p.scale != 0 ? x / p.scale : x);
  return true;
}

uint32_t paramHash(const char *id) {
  uint32_t h = 2166136261u;
  for (const char *s = id; *s; s++) { h ^= (unsigned char)*s; h *= 16777619u; }
  return h & 0x7fffffff;
}

} // namespace phuzzbox
