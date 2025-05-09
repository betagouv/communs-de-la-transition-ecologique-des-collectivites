#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script d'analyse de description de projet pour en extraire des compétences.
Pour le moment, ce script retourne des valeurs hardcodées.
"""

import sys
import json
import time

def analyze_description(description):
    """
    Analyse une description de projet et retourne une liste de compétences.
    Pour le moment, cette fonction retourne des valeurs hardcodées.
    """
    # Simuler un traitement qui prend du temps
    time.sleep(1)
    
    # Liste de compétences hardcodées 
    skills = ["Développement durable", "Transition écologique", "Énergie renouvelable"]
    
    # Exemple d'un traitement conditionnel simple basé sur des mots-clés
    if "énergie" in description.lower():
        skills.append("Énergie")
    
    if "biodiversité" in description.lower():
        skills.append("Biodiversité")
        
    if "mobilité" in description.lower():
        skills.append("Mobilité durable")
        
    return skills

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps(["Développement durable"]))
        sys.exit(1)
        
    description = sys.argv[1]
    skills = analyze_description(description)
    
    # Retourner les compétences au format JSON
    print(json.dumps(skills))
