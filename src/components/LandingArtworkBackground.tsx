export default function LandingArtworkBackground() {
  return (
    <div
      data-testid="landing-artwork-background"
      className="landing-artwork-background"
      aria-hidden="true"
    >
      <img
        src="/assets/themes/landing-red-dragon-hero-v1.png"
        alt=""
        className="landing-artwork-background__art"
        draggable={false}
      />
      <div className="landing-artwork-background__theme-tone" />
      <div className="landing-artwork-background__readability" />
    </div>
  )
}
