"""
Audience-specific Deep Research & Google Search Grounding query packs for HII
(Huntington Ingalls Industries, Newport News Shipbuilding, Ingalls Shipbuilding, Mission Technologies).
"""

AUDIENCE_QUERY_PACKS = {
    "executive": {
        "label": "Executive Branch / Administration",
        "sources": [
            "White House Executive Orders & Maritime Statecraft Directives",
            "White House Office of Shipbuilding & NSC Maritime Industrial Base Briefs",
            "OMB President's Budget Request (Shipbuilding & Conversion, Navy)",
            "OSD / Secretary of Defense posture statements & industrial base assessments",
        ],
        "queries": [
            "White House Executive Order shipbuilding maritime industrial base Huntington Ingalls HII",
            "OMB President defense budget request Navy shipbuilding CVN Virginia Columbia class HII",
            "Secretary of Defense maritime statecraft shipyard workforce investment Newport News Ingalls",
        ],
        "research_prompt": (
            "Conduct deep research on recent Executive Branch / White House / OMB / OSD actions, "
            "executive orders, defense budget requests, and administration policy statements affecting "
            "Huntington Ingalls Industries (HII), Newport News Shipbuilding, Ingalls Shipbuilding, "
            "and the U.S. naval shipbuilding industrial base. Identify concrete dated events, official "
            "sources, and whether each event is positive, neutral, or negative for HII."
        ),
    },
    "congress": {
        "label": "United States Congress",
        "sources": [
            "HASC Seapower & Projection Forces and SASC Seapower hearings",
            "House & Senate Defense Appropriations (HAC-D / SAC-D) markups & reports",
            "National Defense Authorization Act (NDAA) legislative text & conference reports",
            "GAO (Government Accountability Office) & CRS (Congressional Research Service) naval shipbuilding reports",
        ],
        "queries": [
            "GAO report Navy shipbuilding Ford CVN-79 CVN-80 Virginia class Columbia delays HII",
            "CRS report RL32665 Navy Force Structure Shipbuilding Plans Huntington Ingalls",
            "HASC SASC Seapower hearing Newport News Shipbuilding Ingalls NDAA authorization",
        ],
        "research_prompt": (
            "Conduct deep research on Congressional hearings (HASC, SASC, Appropriations), NDAA "
            "provisions, Continuing Resolutions, GAO audits, and CRS reports concerning Huntington "
            "Ingalls Industries (HII) programs (Ford-class carriers CVN-78/79/80/81, Virginia-class SSN, "
            "Columbia-class SSBN, Arleigh Burke DDG-51 Flight III, San Antonio LPD, America LHA). "
            "Include any newly published or retroactively indexed GAO/CRS reports from prior months or years."
        ),
    },
    "navy": {
        "label": "Department of the Navy",
        "sources": [
            "SECNAV & CNO posture statements and 30-Year Shipbuilding Plans",
            "NAVSEA / DoD daily contract awards & definitizations ($7.5M+ threshold)",
            "PEO Aircraft Carriers, PEO Attack Submarines, PEO Ships program reviews",
            "INSURV builder's & acceptance trials, keel layings, christenings, and deliveries",
        ],
        "queries": [
            "NAVSEA contract modification Huntington Ingalls Newport News Shipbuilding Ingalls",
            "SECNAV CNO shipbuilding review Virginia class Columbia class CVN-79 delivery",
            "Department of the Navy Submarine Industrial Base supplier workforce investment HII",
        ],
        "research_prompt": (
            "Conduct deep research on Department of the Navy (SECNAV, CNO, NAVSEA, PEO) contract "
            "awards, shipbuilding plan updates, sea trials, ship deliveries, RCOH availabilities, "
            "and Submarine Industrial Base (SIB) investments impacting Huntington Ingalls Industries (HII)."
        ),
    },
    "public": {
        "label": "American Public & Capital Markets",
        "sources": [
            "HII quarterly earnings releases (10-Q / 10-K), shipbuilding margin & Free Cash Flow guidance",
            "NYSE:HII equity performance vs. defense peer basket (GD, LMT, NOC, ITA ETF, S&P 500)",
            "Wall Street institutional analyst ratings & price target revisions",
            "National & defense trade media (USNI News, Defense News, Breaking Defense, Reuters) and labor news",
        ],
        "queries": [
            "Huntington Ingalls Industries NYSE HII quarterly earnings free cash flow shipbuilding margin",
            "HII stock performance vs General Dynamics Lockheed Northrop ITA defense peers analyst rating",
            "Newport News Shipbuilding Ingalls labor union hiring retention Mission Technologies backlog",
        ],
        "research_prompt": (
            "Conduct deep research on Huntington Ingalls Industries (NYSE: HII) quarterly financial "
            "results, shipbuilding operating margins, Mission Technologies backlog, relative stock "
            "performance against defense peers (GD, LMT, NOC, ITA), Wall Street analyst rating changes, "
            "and major defense/national media coverage."
        ),
    },
}
