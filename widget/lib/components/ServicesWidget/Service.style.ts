import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";

export const useStyles = tss.withParams().create(() => ({
  // container: {
  //   display: "flex",
  //   flexDirection: "column",
  //   alignItems: "center",
  //   overflow: "auto",
  //   width: "calc(100% - 260px)",
  //   ...spacing("padding", { rightLeft: "3w" }),
  //   [fr.breakpoints.down("lg")]: {
  //     width: "100%",
  //   },
  // },

  container: {
    borderRadius: "0.5rem",
    border: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
  },

  card: {
    display: "flex",
    gap: "1.5rem",
    paddingRight: "1rem",
    alignItems: "center",

    [fr.breakpoints.down("md")]: {
      flexDirection: "column",
    },
  },

  title: {
    marginBottom: 0,
    color: fr.colors.decisions.text.default.grey.default,
    fontWeight: 500,
  },

  debugBadge: {
    display: "flex",
    justifyContent: "right",
    width: "90%",
    position: "absolute",
  },

  logoContainer: {
    backgroundColor: "#fbf6ed",
    borderRadius: "3px",
    border: `1px solid ${fr.colors.decisions.border.open.blueFrance.default}`,
    height: "4rem",
    width: "4rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    borderRadius: "calc(0.5rem - 1px)",
    height: "3rem",
    width: "3rem",
  },

  mainContent: {
    flexGrow: 1,
  },

  redirection: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
  },

  description: {
    display: "flex",
    marginBottom: "0.5rem",
    alignItems: "center",
    gap: "0.5rem",
    alignContent: "center",
    color: fr.colors.decisions.text.mention.grey.default,
  },

  extraFields: {
    marginBottom: "0.5rem",
    display: "flex",
    flexDirection: "column",
  },

  extraFieldsForm: {
    width: "50%",
  },

  button: {
    width: "max-content",
  },

  content: {
    borderTop: `1px solid ${fr.colors.decisions.border.default.grey.default}`,
    padding: "1.5rem 1rem",
  },

  iframe: {
    width: "100%",
    border: "none",
  },
}));
