import type { Theme } from "../shared/themes";

const PAPER = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 .42  0 0 0 0 .3  0 0 0 0 .16  0 0 0 .1 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Iznik: a cobalt scalloped border with white rosettes and red dots. */
const IZNIK = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='16'><path d='M0 0H28V8Q21 15 14 8Q7 15 0 8Z' fill='#1d3f8f'/><circle cx='7' cy='5' r='2.6' fill='#f7f5ef'/><circle cx='7' cy='5' r='1.2' fill='#c8312b'/><path d='M21 2.4L23.3 5L21 7.6L18.7 5Z' fill='#4fb8b3'/><circle cx='14' cy='12.6' r='1.1' fill='#c8312b'/><circle cx='0' cy='12.6' r='1.1' fill='#c8312b'/><circle cx='28' cy='12.6' r='1.1' fill='#c8312b'/></svg>",
);

/** Mashrabiya: turned-wood lattice with a bead at every joint. */
const LATTICE = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><path d='M0 7H14M7 0V14' stroke='#140b05' stroke-width='1.4'/><path d='M2.6 7H4M10 7H11.4M7 2.6V4M7 10V11.4' stroke='#140b05' stroke-width='2.6' stroke-linecap='round'/><circle cx='7' cy='7' r='2.4' fill='#140b05'/><circle cx='7' cy='7' r='.9' fill='#5a3a22'/></svg>",
);

/** Isfahan: two staggered rows of muqarnas niches. */
const MUQARNAS = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='24'><rect width='20' height='24' fill='#0d1d52'/><g stroke='#3fc1c9' stroke-width='.8'><path d='M0 12V7Q0 3 10 .8Q20 3 20 7V12Z' fill='#1d3a8f'/><path d='M-10 24V19Q-10 15 0 12.8Q10 15 10 19V24ZM10 24V19Q10 15 20 12.8Q30 15 30 19V24Z' fill='#24479f'/></g><g fill='none' stroke='#f3efe2' stroke-opacity='.35' stroke-width='.6'><path d='M4 12V8.5Q4 6 10 4.6Q16 6 16 8.5V12M-6 24V20.5Q-6 18 0 16.6Q6 18 6 20.5V24M14 24V20.5Q14 18 20 16.6Q26 18 26 20.5V24'/></g><g fill='#f2c14e'><circle cx='10' cy='3.6' r='1.2'/><circle cx='0' cy='15.6' r='1'/><circle cx='20' cy='15.6' r='1'/></g></svg>",
);

/** Marrakech: stepped merlons like the top of a medina wall. */
const MERLONS = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='12'><path d='M0 12V9H3V6H6V3H8L10 .5L12 3H14V6H17V9H20V12Z' fill='#7d2c1b'/></svg>",
);

/** Theme ornaments drawn behind the island's content. */
export function Deco({ theme }: { theme: Theme }) {
  switch (theme.deco) {
    case "zellige":
      return (
        <div className="deco deco-zellige">
          <div className="band" />
        </div>
      );
    case "glow":
      return (
        <div className="deco deco-glow">
          <div className="halo" />
          <div className="hair" />
        </div>
      );
    case "hairline":
      return (
        <div className="deco deco-hairline">
          <div className="line" />
        </div>
      );
    case "dunes":
      return (
        <div className="deco deco-dunes">
          <svg viewBox="0 0 340 90" preserveAspectRatio="none">
            <path d="M0 52 Q 70 26 150 48 T 340 38 V90 H0Z" fill="rgba(60,30,80,.45)" />
            <path d="M0 72 Q 90 48 190 70 T 340 62 V90 H0Z" fill="rgba(35,22,62,.75)" />
          </svg>
          <div className="moon" />
        </div>
      );
    case "arch":
      return (
        <div className="deco deco-arch">
          <svg viewBox="0 0 200 200" preserveAspectRatio="none">
            <path d="M8 198 V80 Q8 30 100 4 Q192 30 192 80 V198" fill="none" stroke="#f2b84b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <path d="M18 198 V84 Q18 40 100 16 Q182 40 182 84 V198" fill="none" stroke="#f2b84b" strokeWidth=".6" strokeOpacity=".5" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      );
    case "paper":
      return (
        <div className="deco deco-paper" style={{ backgroundImage: PAPER }}>
          <div className="rule" />
        </div>
      );
    case "iznik":
      return (
        <div className="deco deco-iznik">
          <div className="band" style={{ backgroundImage: IZNIK }} />
        </div>
      );
    case "lattice":
      return (
        <div className="deco deco-lattice">
          <div className="screen" style={{ backgroundImage: LATTICE }} />
        </div>
      );
    case "muqarnas":
      return (
        <div className="deco deco-zellige">
          <div className="band" style={{ backgroundImage: MUQARNAS, backgroundSize: "auto 100%" }} />
        </div>
      );
    case "horizon":
      return (
        <div className="deco deco-horizon">
          <div className="sun" />
          <div className="star" />
        </div>
      );
    case "merlons":
      return (
        <div className="deco deco-merlons">
          <div className="wall" style={{ backgroundImage: MERLONS }} />
        </div>
      );
    default:
      return null;
  }
}
