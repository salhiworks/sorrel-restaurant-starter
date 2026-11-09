import { Hero } from "@/components/site/hero"
import { Showcase } from "@/components/site/showcase"
import { MenuSection } from "@/components/site/menu-section"
import { Story } from "@/components/site/story"
import { Visit } from "@/components/site/visit"

export default function HomePage() {
  return (
    <>
      <Hero />
      <Showcase />
      <MenuSection />
      <Story />
      <Visit />
    </>
  )
}
