"use client";

export default function HeroAnimation() {

  return (
    <>
      {/* Byskyline – stiger opp fra bunnen ved innlasting */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden animate-skyline-rise">
        <svg
          viewBox="0 0 1440 160"
          preserveAspectRatio="xMidYMax meet"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          style={{ display: "block" }}
        >
          <g fill="rgba(255,255,255,0.055)">
            {/* Venstre side */}
            <rect x="0" y="100" width="55" height="60" />
            <rect x="60" y="55" width="45" height="105" />
            <rect x="65" y="45" width="35" height="10" /> {/* antenne */}
            <rect x="115" y="75" width="70" height="85" />
            <rect x="130" y="65" width="15" height="10" />
            <rect x="195" y="30" width="40" height="130" />
            <rect x="207" y="18" width="16" height="12" />
            <rect x="245" y="65" width="60" height="95" />

            {/* Hus 1 */}
            <polygon points="320,75 365,42 410,75" />
            <rect x="320" y="75" width="90" height="85" />
            <rect x="347" y="105" width="26" height="55" /> {/* dør */}
            <rect x="328" y="88" width="18" height="14" /> {/* vindu */}
            <rect x="364" y="88" width="18" height="14" />

            {/* Høyblokker midten */}
            <rect x="420" y="50" width="50" height="110" />
            <rect x="480" y="20" width="38" height="140" />
            <rect x="490" y="10" width="18" height="10" />
            <rect x="528" y="60" width="65" height="100" />
            <rect x="603" y="40" width="45" height="120" />

            {/* Hus 2 */}
            <polygon points="660,80 705,44 750,80" />
            <rect x="660" y="80" width="90" height="80" />
            <rect x="687" y="108" width="26" height="52" />
            <rect x="668" y="93" width="16" height="13" />
            <rect x="706" y="93" width="16" height="13" />

            {/* Høyre side */}
            <rect x="755" y="35" width="48" height="125" />
            <rect x="765" y="24" width="18" height="11" />
            <rect x="813" y="55" width="70" height="105" />
            <rect x="893" y="75" width="50" height="85" />
            <rect x="953" y="25" width="42" height="135" />
            <rect x="962" y="14" width="14" height="11" />
            <rect x="1005" y="60" width="75" height="100" />

            {/* Hus 3 */}
            <polygon points="1092,78 1135,46 1178,78" />
            <rect x="1092" y="78" width="86" height="82" />
            <rect x="1119" y="106" width="25" height="54" />
            <rect x="1100" y="91" width="16" height="13" />
            <rect x="1145" y="91" width="16" height="13" />

            {/* Avslutning høyre */}
            <rect x="1188" y="50" width="55" height="110" />
            <rect x="1253" y="70" width="45" height="90" />
            <rect x="1308" y="30" width="50" height="130" />
            <rect x="1320" y="19" width="16" height="11" />
            <rect x="1368" y="65" width="72" height="95" />
          </g>
        </svg>
      </div>
    </>
  );
}
