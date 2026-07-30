// src/graph/ConceptGraph.tsx
import { headers } from "next/headers";
import { conceptIds, graphTree } from "@agentic-toolkit/adh/concepts";
import { detectEnv } from "@agentic-toolkit/adh-registry";
import { ConceptGraphClient } from "@agentic-toolkit/adh/graph/ConceptGraphClient";
import { jsx } from "react/jsx-runtime";
async function ConceptGraph({
  focusId,
  eyebrow,
  titleLead,
  titleAccent,
  currentSiteId
}) {
  const tree = graphTree();
  const initial = conceptIds.has(focusId) ? focusId : tree.id;
  const env = detectEnv((await headers()).get("host") ?? "");
  return /* @__PURE__ */ jsx(
    ConceptGraphClient,
    {
      tree,
      initialFocusId: initial,
      eyebrow,
      titleLead,
      titleAccent,
      currentSiteId,
      env
    }
  );
}

// src/graph/LandingGraph.tsx
import { getSite, splitSiteTitle } from "@agentic-toolkit/adh-registry";
import { siteConcept } from "@agentic-toolkit/adh/concepts";
import { jsx as jsx2 } from "react/jsx-runtime";
function LandingGraph({ siteId, focusId }) {
  const node = siteConcept(siteId);
  const initial = focusId && focusId.length > 0 ? focusId : node?.id ?? "hub";
  const site = getSite(siteId);
  const { titleLead, titleAccent } = site ? splitSiteTitle(site) : { titleLead: "", titleAccent: node?.label ?? "Agentic Developer" };
  return /* @__PURE__ */ jsx2(
    ConceptGraph,
    {
      focusId: initial,
      eyebrow: node?.kicker,
      titleLead,
      titleAccent,
      currentSiteId: siteId
    }
  );
}
export {
  ConceptGraph,
  LandingGraph
};
//# sourceMappingURL=index.js.map