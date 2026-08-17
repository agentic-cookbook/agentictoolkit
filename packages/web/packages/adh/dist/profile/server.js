// src/profile/normalize.ts
function principalFromUserCard(body) {
  return { ...body, kind: "user" };
}
function principalFromOrgCard(body) {
  return {
    slug: body.slug,
    displayName: body.displayName,
    createdAt: body.createdAt,
    description: body.description,
    personas: body.personas,
    avatarUrl: null,
    socialLinks: [],
    emails: [],
    phones: [],
    addresses: [],
    kind: "organization"
  };
}

// src/profile/server.ts
async function fetchPublicPrincipal(slug) {
  const backend = process.env.API_BACKEND_URL?.trim().replace(/\/+$/, "");
  if (!backend) {
    throw new Error(
      "API_BACKEND_URL is not set. Configure it in each Vercel project (and .env.local for local dev, e.g. http://localhost:8080)."
    );
  }
  const encoded = encodeURIComponent(slug);
  const users = await fetch(`${backend}/public/users/${encoded}`, { next: { revalidate: 30 } });
  if (users.ok) {
    return principalFromUserCard(await users.json());
  }
  if (users.status !== 404) throw new Error(`Failed to fetch profile: ${users.status}`);
  const orgs = await fetch(`${backend}/public/orgs/${encoded}`, { next: { revalidate: 30 } });
  if (orgs.ok) {
    return principalFromOrgCard(await orgs.json());
  }
  if (orgs.status !== 404) throw new Error(`Failed to fetch profile: ${orgs.status}`);
  return null;
}
export {
  fetchPublicPrincipal
};
//# sourceMappingURL=server.js.map