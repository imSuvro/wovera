import { Redirect } from "expo-router";

/** The site root and fresh app opens land on the Lamp — capture is the front door. */
export default function Index() {
  return <Redirect href="/lamp" />;
}
