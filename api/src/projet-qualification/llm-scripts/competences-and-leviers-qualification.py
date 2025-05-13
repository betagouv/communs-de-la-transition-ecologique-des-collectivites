# -*- coding: utf-8 -*-

# Import python's built-in regular expression library
import re
import anthropic
from dotenv import load_dotenv
import os
import argparse
import json
import sys
import base64
import copy
import logging

load_dotenv()
API_KEY = os.getenv("ANTHROPIC_API_KEY")

client = anthropic.Anthropic(api_key=API_KEY)

logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Importing the prompts, hard-coded in a separate file
from prompts_leviers_competences import (
    system_prompt_classification_TE,
    user_prompt_classification_TE,
    system_prompt_competences,
    user_prompt_competences,
    system_prompt_competences_V2,
    user_prompt_competences_V2,
    few_shot_exs_competences_V2,
    system_prompt_resume_projet,
    user_prompt_resume_projet,
    system_prompt_questions_fermees_boussole,
    user_prompt_questions_fermees_boussole,
    leviers,
    corrections_leviers,
    competences_V2,
    competences,
    corrections_competences,
    corrections_sous_competences
)


def post_treatment_leviers(json_data, leviers_list, corrections_leviers):
    """
    Post-processes leviers (levers) in a JSON response by correcting or removing invalid levers.
    
    This function takes a JSON response containing project information and levers, validates each lever
    against a reference list, and either corrects the lever name using a corrections dictionary or
    removes it if no valid correction exists. The resulting levers are sorted by score in descending order.
    
    Args:
        json_data (dict): A dictionary containing project data with the following structure:
            {
                'projet': str,
                'classification': str,
                'leviers': dict[str, float]
            }
        leviers_list (list): List of valid lever names to check against
        corrections_leviers (dict): Dictionary mapping incorrect lever names to their correct forms
    
    Returns:
        dict: A copy of the input dictionary with processed levers, where:
            - Invalid levers not in corrections_leviers are removed
            - Incorrect lever names are replaced with their corrections
            - Levers are sorted by score in descending order
    """
    
    # Create a deep copy of the entire json_data
    result = copy.deepcopy(json_data)
    
    # Create a copy of leviers to avoid modifying the dict during iteration
    leviers_to_process = dict(result["leviers"])
    
    # Iterate through the copy
    for levier in leviers_to_process:
        # Check if levier is not in the reference list
        if levier not in leviers_list:
            # Check if it exists in corrections dictionary
            if levier in corrections_leviers:
                # Get the corrected value and its score
                corrected_levier = corrections_leviers[levier]
                score = result["leviers"][levier]
                
                # Delete the old key
                del result["leviers"][levier]
                
                # Add the corrected key with the same score
                result["leviers"][corrected_levier] = score
            else:
                # If not in corrections, simply remove it
                del result["leviers"][levier]
    
    # Sort leviers by score in descending order
    sorted_leviers = dict(sorted(result["leviers"].items(), key=lambda x: x[1], reverse=True))
    result["leviers"] = sorted_leviers
    
    return result


def classification_TE(projet: str, system_prompt=system_prompt_classification_TE, user_prompt=user_prompt_classification_TE, model="haiku"):
    """
    Classifies a project's relationship with ecological transition and identifies relevant levers.

    This function uses the Claude LLM to analyze a project description and:
    1. Determines if the project has a link to ecological transition
    2. Identifies relevant levers and their scores
    3. Provides reasoning for the classification
    4. Post-processes the levers to ensure they match reference lists or corrections

    Args:
        projet (str): Description of the project to analyze
        system_prompt (str, optional): System prompt for the LLM. Defaults to system_prompt_classification_TE.
        user_prompt (str, optional): User prompt for the LLM. Defaults to user_prompt_classification_TE.
        model (str, optional): Model version to use ("haiku" or "sonnet"). Defaults to "haiku".

    Returns:
        dict: A dictionary containing:
            - projet (str): Original project description
            - classification (str): Project's relationship with ecological transition
            - leviers (dict): Dictionary of relevant levers and their scores (0-1),
                            post-processed and sorted by descending score
            - raisonnement (str): Detailed reasoning for the classification

    Example:
        >>> result = classification_TE("Rénovation énergétique d'un bâtiment public")
        >>> result
        {
            'projet': "Rénovation énergétique d'un bâtiment public",
            'classification': 'Le projet a un lien avec la transition écologique',
            'leviers': {
                'Sobriété des bâtiments (tertiaire)': 0.9,
                'Rénovation (hors changement chaudières)': 0.8
            },
            'raisonnement': '...'
        }
    """
    
    # Use the MODEL_NAME variable that's being set
    model_name = "claude-3-7-sonnet-20250219" if model == "sonnet" else "claude-3-5-haiku-20241022"
    #print(model_name)
    response = client.messages.create(
        model=model_name,  # Use the variable instead of hardcoding
        max_tokens=1024,
        temperature=0.3,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }
        ],
            messages=[
        {
            "role": "user",
            "content":
            [{"type": "text",
            "text": user_prompt
            ,"cache_control": {"type": "ephemeral"}
            },
            {
                "type": "text",
                "text":  "<projet>\n" + projet + "\n</projet>"
            }
            ]
        }
    ]
        )   
    # Print token usage information
    # input_tokens = response.usage.input_tokens
    # output_tokens = response.usage.output_tokens
    # input_tokens_cache_read = getattr(response.usage, 'cache_read_input_tokens', '---')
    # input_tokens_cache_create = getattr(response.usage, 'cache_creation_input_tokens', '---')
    # print(f"User input tokens: {input_tokens}")
    # print(f"Output tokens: {output_tokens}")
    # print(f"Input tokens (cache read): {input_tokens_cache_read}")
    # print(f"Input tokens (cache write): {input_tokens_cache_create}")
    # print(response.content[0].text)

    # Extract content between <json> and <raisonnement> tags
    json_content = re.search(r'<json>(.*?)</json>', response.content[0].text, re.DOTALL)
    raisonnement_content = re.search(r'<raisonnement>(.*?)</raisonnement>', response.content[0].text, re.DOTALL)
    
    # Initialize response dictionary
    response_dict = {
        "projet": projet,
        "classification": None,
        "leviers": [],
        "raisonnement": None
    }
    
    # Parse JSON content
    if json_content:
        json_str = json_content.group(1).strip()
        try:
            json_data = json.loads(json_str)
            # post-treatment of the LLM response for leviers
            json_data = post_treatment_leviers(json_data, leviers, corrections_leviers)
            response_dict.update(json_data)
        except json.JSONDecodeError:
            response_dict["classification"] = "Error in treating the project: Invalid JSON format"
    else:
        print("No JSON content found in the response.")
        response_dict["classification"] = "Error in treating the project: No JSON content found in the LLM response"
    
    # Add reasoning
    if raisonnement_content:
        response_dict["raisonnement"] = raisonnement_content.group(1).strip()
    else:
        response_dict["raisonnement"] = "No raisonnement found in the response."
    return response_dict

def post_treatment_competences(json_data, competences_list, corrections_competences, corrections_sous_competences):
    """
    Post-processes competences and sub-competences in a JSON response by correcting or removing invalid entries.
    
    This function takes a JSON response containing project information and competences, validates each competence
    and sub-competence against reference lists, corrects them using corrections dictionaries, validates the pairs,
    and removes invalid entries. The resulting competences are sorted by score in descending order.
    
    Args:
        json_data (dict): A dictionary containing project data with the following structure:
            {
                'projet': str,
                'competences': list[dict] where each dict contains:
                    - 'competence': str
                    - 'sous_competence': str
                    - 'score': float
            }
        competences_list (dict): Dictionary of valid competences with their associated sub-competences
        corrections_competences (dict): Dictionary mapping incorrect competence names to their correct forms
        corrections_sous_competences (dict): Dictionary mapping incorrect sub-competence names to their correct forms
    
    Returns:
        dict: A copy of the input dictionary with processed competences
    """
    # Create a deep copy of the entire json_data
    result = copy.deepcopy(json_data)
    
    # Create a copy of competences to avoid modifying the list during iteration
    competences_to_process = list(result["competences"])
    result["competences"] = []
    
    # Iterate through the copy
    for comp in competences_to_process:
        competence_name = comp["competence"]
        sous_competence_name = comp["sous_competence"]
        score = comp["score"]
        
        # Check and correct competence name if needed
        if competence_name not in competences_list:
            if competence_name in corrections_competences:
                competence_name = corrections_competences[competence_name]
            else:
                continue  # Skip this entry if competence is invalid and has no correction
        
        # Check if competence has possible sub-competences
        has_possible_sous_competences = bool(competences_list.get(competence_name, []))
        
        if has_possible_sous_competences:
            # If competence has possible sub-competences, it must have a valid one
            if not sous_competence_name:
                continue  # Skip if no sub-competence provided
            
            # Try to correct sub-competence if invalid
            if sous_competence_name not in competences_list[competence_name]:
                if sous_competence_name in corrections_sous_competences:
                    sous_competence_name = corrections_sous_competences[sous_competence_name]
                else:
                    continue  # Skip if sub-competence invalid and no correction exists
            
            # Verify corrected sub-competence is valid for this competence
            if sous_competence_name not in competences_list[competence_name]:
                continue
        else:
            # If competence has no possible sub-competences, it should not have one
            sous_competence_name = ""
        
        # Add the processed competence entry
        result["competences"].append({
            "competence": competence_name,
            "sous_competence": sous_competence_name,
            "score": score
        })
    
    # Sort competences by score in descending order
    result["competences"].sort(key=lambda x: x["score"], reverse=True)
    
    return result

def post_treatment_competences_V2(json_data, competences_dict, corrections_competences_V2 = None):
    """
    Post-processes competences and sub-competences in a JSON response by correcting or removing invalid entries.
    
    Args:
        json_data (dict): Input JSON with project and competences
        competences_dict (dict): Dictionary of valid codes & competences
        corrections_competences_V2 (dict, optional): Dictionary for corrections
    
    Returns:
        dict: Processed JSON with validated/corrected competences
    """
    result = copy.deepcopy(json_data)
    
    # Create reverse lookup for competence description to code
    desc_to_code = {v: k for k, v in competences_dict.items()}
    
    # Filter and correct competences
    valid_competences = []
    for comp in result["competences"]:
        code = comp.get("code")  # Use get to handle potential missing keys
        desc = comp.get("competence")
        
        # Handle None/null values
        if code is None or code == "":
            # Case: Null code
            if desc is not None and desc in desc_to_code:
                # If description is valid, assign the correct code
                comp["code"] = desc_to_code[desc]
                valid_competences.append(comp)
            # If description is also invalid/null, drop it (hallucination)
            continue
            
        # Case 1: Valid code
        if code in competences_dict:
            # Null description but valid code
            if desc is None or desc == "":
                # Assign the correct description from the dictionary
                comp["competence"] = competences_dict[code]
                valid_competences.append(comp)
            # Check for mismatch between code and description
            elif competences_dict[code] != desc:
                # If description exists in our dictionary, use its code
                if desc in desc_to_code:
                    comp["code"] = desc_to_code[desc]
                    valid_competences.append(comp)
                # If description doesn't exist, use description from competences_dict
                else:
                    comp["competence"] = competences_dict[code]
                    valid_competences.append(comp)
            else:
                # Perfect match, keep as is
                valid_competences.append(comp)
                
        # Case 2: Invalid code
        else:
            # Check if description exists in our dictionary
            if desc is not None and desc in desc_to_code:
                comp["code"] = desc_to_code[desc]
                valid_competences.append(comp)
            # If neither code nor description are valid, drop it (hallucination)
    
    result["competences"] = valid_competences
    
    # Sort by score
    result["competences"].sort(key=lambda x: x.get("score", 0), reverse=True)
    
    return result

def classification_competences(projet: str, system_prompt=system_prompt_competences, user_prompt=user_prompt_competences, model="haiku"):
    """
    Classifies a project based on required competences and sub-competences.
    
    This function uses the Claude LLM to analyze a project description and identify
    relevant competences and sub-competences needed for the project, along with their scores.
    The results are post-processed to ensure they match reference lists or corrections.
    
    Args:
        projet (str): Description of the project to analyze
        system_prompt (str, optional): System prompt for the LLM. Defaults to system_prompt_competences.
        user_prompt (str, optional): User prompt for the LLM. Defaults to user_prompt_competences.
        model (str, optional): Model version to use ("haiku" or "sonnet"). Defaults to "haiku".
        
    Returns:
        dict: A dictionary containing:
            - projet (str): Original project description
            - competences (list): List of dictionaries, each containing:
                - competence (str): The competence name
                - sous_competence (str): The sub-competence name (if applicable)
                - score (float): Relevance score for this competence (0-1)
              The competences are post-processed and sorted by descending score.
    
    Example:
        >>> result = classification_competences("Rénovation thermique de la mairie")
        >>> result
        {
            'projet': "Rénovation thermique de la mairie",
            'competences': [
                {'competence': 'Habitat', 'sous_competence': 'Bâtiments et construction', 'score': 0.9},
                {'competence': 'Habitat', 'sous_competence': 'Equipement public', 'score': 0.9},
                {'competence': 'Actions en matière de gestion des eaux', 'sous_competence': 'Eau potable', 'score': 0.4}
            ]
        }
    """
    # Use the MODEL_NAME variable that's being set
    model_name = "claude-3-7-sonnet-20250219" if model == "sonnet" else "claude-3-5-haiku-20241022"
    #print(model_name)
    response = client.messages.create(
        model=model_name,  # Use the variable instead of hardcoding
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }
        ],
            messages=[
        {
            "role": "user",
            "content":
            [{"type": "text",
            "text": user_prompt
            ,"cache_control": {"type": "ephemeral"}
            },
            {
                "type": "text",
                "text":  "<projet>\n" + projet + "\n</projet>"
            }
            ]
        }
    ]
        )   
    # Print token usage information
    # input_tokens = response.usage.input_tokens
    # output_tokens = response.usage.output_tokens
    # input_tokens_cache_read = getattr(response.usage, 'cache_read_input_tokens', '---')
    # input_tokens_cache_create = getattr(response.usage, 'cache_creation_input_tokens', '---')
    # print(f"User input tokens: {input_tokens}")
    # print(f"Output tokens: {output_tokens}")
    # print(f"Input tokens (cache read): {input_tokens_cache_read}")
    # print(f"Input tokens (cache write): {input_tokens_cache_create}")
    # print(response.content[0].text)

    #Extract content between <json> 
    json_content = re.search(r'<json>(.*?)</json>', response.content[0].text, re.DOTALL)    
    # Initialize response dictionary
    response_dict = {
        "projet": projet,
        "competences": [],
        "errorMessage": ""
    }
    
    # Parse JSON content
    if json_content:
        json_str = json_content.group(1).strip()
        try:
            json_data = json.loads(json_str)
            # post-treatment of the LLM response for competences
            json_data = post_treatment_competences(json_data, competences,corrections_competences,corrections_sous_competences)
            response_dict.update(json_data)
        except json.JSONDecodeError:
            response_dict["errorMessage"] = "Error in treating the project: Invalid JSON format"
    else:
        logger.debug("No JSON content found in the response.")
        response_dict["errorMessage"] = "Error in treating the project: No JSON content found"
    
    return response_dict

def classification_competences_V2(projet: str, system_prompt=system_prompt_competences_V2, user_prompt=user_prompt_competences_V2,  examples_prompt = few_shot_exs_competences_V2, model="haiku"):
    # Use the MODEL_NAME variable that's being set
    model_name = "claude-3-7-sonnet-20250219" if model == "sonnet" else "claude-3-5-haiku-20241022"
    #print(model_name)
    response = client.messages.create(
        model=model_name,  # Use the variable instead of hardcoding
        temperature = 0.5,
        max_tokens=1024,
        system=[{"type": "text","text": system_prompt,"cache_control": {"type": "ephemeral"}}],
        messages = [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": examples_prompt, "cache_control": {"type": "ephemeral"}},
                        {"type": "text", "text": user_prompt, "cache_control": {"type": "ephemeral"}},
                        {"type": "text", "text": f"<projet>\n{projet}\n</projet>"}
                    ]
                }]

    )   
    # Print token usage information
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens
    input_tokens_cache_read = getattr(response.usage, 'cache_read_input_tokens', '---')
    input_tokens_cache_create = getattr(response.usage, 'cache_creation_input_tokens', '---')
    logger.debug(f"User input tokens: {input_tokens}")
    logger.debug(f"Output tokens: {output_tokens}")
    logger.debug(f"Input tokens (cache read): {input_tokens_cache_read}")
    logger.debug(f"Input tokens (cache write): {input_tokens_cache_create}")
    #print(response.content[0].text)

    #Extract content between <json> 
    json_content = re.search(r'<json>(.*?)</json>', response.content[0].text, re.DOTALL)    
    # Initialize response dictionary
    response_dict = {
        "projet": projet,
        "competences": [],
        "errorMessage": ""
    }
    
    # Parse JSON content
    if json_content:
        json_str = json_content.group(1).strip()
        try:
            json_data = json.loads(json_str)
            logger.debug("LLM response before post-treatment: \n",json_data)
            # post-treatment of the LLM response for competences
            json_data = post_treatment_competences_V2(json_data, competences_V2,None)
            #print("--------------------------------\n")
            logger.debug("LLM response after post-treatment: \n",json_data)
            response_dict.update(json_data)
        except json.JSONDecodeError:
            response_dict["errorMessage"] = "Error in treating the project: Invalid JSON format"
    else:
        logger.debug("No JSON content found in the response.")
        response_dict["errorMessage"] = "Error in treating the project: No JSON content found"
    
    return response_dict


def generation_questions_fermees(projet: str, system_prompt=system_prompt_questions_fermees_boussole, user_prompt=user_prompt_questions_fermees_boussole, model="haiku"):
    """
    Generates closed-ended questions for a project based on its description.
    
    This function uses the Claude LLM to analyze a project description and generate
    a set of closed-ended questions that can help gather more information about the
    project's relevance to ecological transition.
    
    Args:
        projet (str): Description of the project to analyze
        system_prompt (str, optional): System prompt for the LLM.
                                     Defaults to system_prompt_questions_fermees_boussole.
        user_prompt (str, optional): User prompt for the LLM. 
                                   Defaults to user_prompt_questions_fermees_boussole.
        model (str, optional): Model version to use ("haiku" or "sonnet"). Defaults to "haiku".
        
    Returns:
        dict: A dictionary containing generated questions, typically with keys Q1, Q2, Q3,
              where each value is itself a dictionary containing the question and possible answers.
              Returns empty or None values for questions if an error occurs.
    
    Example:
        >>> questions = generation_question_fermes("Création d'un city-stade")
        >>> questions
        {
            'Q1': "Le projet prévoit-il l'utilisation de matériaux de construction recyclés ou à faible impact environnemental ?",
            'Q2': 'Le city-stade intègre-t-il des aménagements favorisant la biodiversité locale (végétalisation, zones naturelles) ?',
            'Q3': "Le projet inclut-il des dispositifs de récupération des eaux de pluie ou d'éclairage économe en énergie ?"
        }
    """
    # Use the MODEL_NAME variable that's being set
    model_name = "claude-3-7-sonnet-20250219" if model == "sonnet" else "claude-3-5-haiku-20241022"
    #print(LLM_response)
    response = client.messages.create(
        model=model_name,
        temperature = 0.6,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }
        ],
            messages=[
        {
            "role": "user",
            "content":
            [{"type": "text",
            "text": user_prompt
            },
            {
                "type": "text",
                "text":  "<projet>\n" + projet + "\n</projet>"
            }
            ]
        }
    ]
        )   
    #print(response.content[0].text)

    # Extract content between <json> and <raisonnement> tags
    json_content = re.search(r'<json>(.*?)</json>', response.content[0].text, re.DOTALL)
    
    # Parse JSON content
    if json_content:
        json_str = json_content.group(1).strip()
        try:
            json_data = json.loads(json_str)
            return json_data
        except json.JSONDecodeError:
            print("Error: Invalid JSON format in response")
            return {
                "Q1": None,
                "Q2": None, 
                "Q3": None
            }
    else:
        print("No JSON content found in response")
        return {
            "Q1": None,
            "Q2": None,
            "Q3": None
        }

def generation_resume(projet, question_reponses, system_prompt=system_prompt_resume_projet, user_prompt=user_prompt_resume_projet, model="haiku"):
    """
    Generates a summary of a project based on its description and answers to questions.
    
    This function uses the Claude LLM to create a comprehensive summary of a project by 
    combining the original project description with answers to previously generated questions.
    The summary provides a more structured and detailed understanding of the project.
    
    Args:
        projet (str): Description of the project to analyze
        question_reponses (dict): Dictionary containing questions and their answers
        system_prompt (str, optional): System prompt for the LLM. Defaults to system_prompt_resume_projet.
        user_prompt (str, optional): User prompt for the LLM. Defaults to user_prompt_resume_projet.
        model (str, optional): Model version to use ("haiku" or "sonnet"). Defaults to "haiku".
        
    Returns:
        str: A text summary of the project incorporating the answers to the questions
        
    Example:
        >>> answers = {"Le projet prévoit-il l'utilisation de matériaux de construction recyclés ou à faible impact environnemental ?":"non",
                        "Le city-stade intègre-t-il des aménagements favorisant la biodiversité locale (végétalisation, zones naturelles) ?":"oui",
                        "Le projet inclut-il des dispositifs de récupération des eaux de pluie ou d'éclairage économe en énergie ?":"oui"}
        >>> summary = generation_resume("Création d'un city-stade", answers)
        >>> summary
        "Création d'un city-stade intégrant des aménagements favorables à la biodiversité locale, avec des dispositifs de récupération des eaux de pluie et d'éclairage économe en énergie, offrant un espace sportif et environnemental innovant."
    """
    # Use the MODEL_NAME variable that's being set
    model_name = "claude-3-7-sonnet-20250219" if model == "sonnet" else "claude-3-5-haiku-20241022"
    #print(model_name)
    question_reponses = json.dumps(question_reponses, ensure_ascii=False)
    #print(answers)

    response = client.messages.create(
        model=model_name,  # Use the variable instead of hardcoding
        max_tokens=1024,
        temperature = 0.3,
        system=[
            {
                "type": "text",
                "text": system_prompt            }
        ],
            messages=[
        {
            "role": "user",
            "content":
            [{"type": "text",
            "text": user_prompt            },
            {
                "type": "text",
                "text":  "\n <projet>\n" + projet + "\n</projet>\n\n <questions_reponses>\n" + question_reponses + "\n</questions_reponses>"
            }
            ]
        }
    ]
        )   
    resume = response.content[0].text

    return resume

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='matching de projet écologique avec leviers FNV')
    parser.add_argument('projet', help='Description du projet à analyser')
    parser.add_argument('--type', default='TE', choices=['TE', 'competences', 'questions', 'resume'],
                       help='Type d\'analyse à effectuer')
    parser.add_argument('--answers', type=str, help='Questions answers for resume generation')
    args = parser.parse_args()
    
    if args.type == 'TE':
        response_classification = classification_TE(
            projet=args.projet,  # This will be either the original description or the resume
            system_prompt=system_prompt_classification_TE,
            user_prompt=user_prompt_classification_TE,
            model="haiku"
        )
        print(json.dumps(response_classification, ensure_ascii=False))
    elif args.type == 'questions':
        try:
            questions = generation_questions_fermees(
                projet=args.projet,
                model="haiku"
            )
            print(json.dumps(questions, ensure_ascii=False))
        except Exception as e:
            print(f"Error generating questions: {e}", file=sys.stderr)
            sys.exit(1)
    elif args.type == 'resume':
        try:
            print("[DEBUG] Starting resume generation", file=sys.stderr)
            print(f"[DEBUG] Received answers: {args.answers}", file=sys.stderr)
            
            answers = json.loads(args.answers)
            resume = generation_resume(
                projet=args.projet,
                question_reponses=answers,
                model="haiku"
            )
            print(resume)  # The function already returns formatted text
        except Exception as e:
            print(f"Error generating resume: {e}", file=sys.stderr)
            print(f"Args received: {args}", file=sys.stderr)
            sys.exit(1)
    else:
        response_competences = classification_competences_V2(
            projet=args.projet,
            system_prompt=system_prompt_competences_V2,
            user_prompt=user_prompt_competences_V2,
            examples_prompt=few_shot_exs_competences_V2,
            model="haiku"
        )
        print(json.dumps(response_competences, ensure_ascii=False))