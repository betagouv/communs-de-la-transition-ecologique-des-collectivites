import { fr } from "@codegouvfr/react-dsfr";
import { tss } from "tss-react";

export const useStyles = tss.create(() => ({
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

  logoContainer: {
    backgroundColor: "#FBF5F2",
    borderRadius: "3px",
    border: `1px solid ${fr.colors.decisions.border.open.blueFrance.default}`,
    height: "4rem",
    minWidth: "4rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    [fr.breakpoints.down("md")]: {
      alignSelf: "start",
    },
  },

  logo: {
    borderRadius: "calc(0.5rem - 1px)",
    height: "3rem",
    width: "3rem",
    objectFit: "contain",
  },

  titleContainer: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.5rem",
    alignContent: "center",
    "> span": {
      marginBottom: 0,
      color: fr.colors.decisions.text.default.grey.default,
      fontWeight: 500,
    },
  },

  sousTitre: {
    color: fr.colors.decisions.text.default.grey.default,
    fontWeight: 500,
    fontSize: "15px",
    display: "block",
    marginBottom: "0.5rem",
  },

  debugBadge: {
    display: "flex",
    justifyContent: "right",
    width: "90%",
    position: "absolute",
  },

  mainContent: {
    flexGrow: 1,
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

  toggleDescriptionBtn: {
    marginLeft: "-0.5rem",
  },

  redirectionBtn: {
    width: "max-content",
  },
}));
