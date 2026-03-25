// This is a decorative component. It's an SVG of a Christmas garland.
// Sourced and adapted for horizontal tiling.
export function ChristmasGarland() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 800 40"
            preserveAspectRatio="none"
            className="w-full h-full"
        >
            <defs>
                <pattern id="garland-pattern" x="0" y="0" width="200" height="40" patternUnits="userSpaceOnUse">
                    {/* Branch */}
                    <path
                        d="M0 20 Q 25 5, 50 20 T 100 20 T 150 20 T 200 20"
                        stroke="#166534" // dark green
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                    />
                    {/* Red Light */}
                    <circle cx="25" cy="25" r="5" fill="#E53935">
                        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                    </circle>
                    {/* Yellow Light */}
                    <circle cx="75" cy="15" r="5" fill="#FFC107">
                         <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
                    </circle>
                    {/* Blue Light */}
                    <circle cx="125" cy="25" r="5" fill="#1E88E5">
                         <animate attributeName="opacity" values="1;0.5;1" dur="2s" begin="1s" repeatCount="indefinite" />
                    </circle>
                    {/* Green Light */}
                     <circle cx="175" cy="15" r="5" fill="#4CAF50">
                        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" begin="1s" repeatCount="indefinite" />
                    </circle>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#garland-pattern)" />
        </svg>
    );
}
