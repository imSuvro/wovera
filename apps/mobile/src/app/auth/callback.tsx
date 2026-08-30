import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { supabase } from "../../sync/supabase";

/**
 * Where Google comes back to.
 *
 * The browser sheet usually hands the code straight back to the code that
 * opened it — but Android also delivers the redirect to the app as a deep
 * link, and without a room at this address the router has nowhere to put
 * it. So this is that room: it finishes the exchange if nobody has yet,
 * then steps aside. Nothing is ever drawn here.
 */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (supabase && code) {
        const { data } = await supabase.auth.getSession();
        // A code can only be spent once; if the sheet already spent it,
        // the session is here and this is simply the door swinging shut.
        if (!data.session) await supabase.auth.exchangeCodeForSession(code);
      }
      if (!cancelled) router.replace("/");
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return <View />;
}
