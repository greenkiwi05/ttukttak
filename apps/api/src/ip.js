// 내 IP 확인 (/api/ip): 이 요청을 보낸 접속 IP와, Cloudflare가 붙여 주는 대략적인 위치·통신사를 그대로 돌려준다.
// 아무것도 저장하거나 기록하지 않는다. 응답은 사람마다 다르므로 캐시하지 않는다(no-store).
export function ipInfo(headers, cf = {}) {
  const ip = headers.get('cf-connecting-ip') || headers.get('x-real-ip') || null;
  const s = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    ip,
    country: s(cf.country),
    region: s(cf.region),
    city: s(cf.city),
    isp: s(cf.asOrganization),
    asn: Number.isInteger(cf.asn) ? cf.asn : null,
  };
}
