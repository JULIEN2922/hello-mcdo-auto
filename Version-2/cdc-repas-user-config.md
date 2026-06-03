

faire tableur employer pris repas pris pour le mois ( 2 shift pas jour possible ) 1 pris | 0 pas pris

tableau repas par mois / avoir le total de repas pris par mois par equipier .

pouvoir l'exporter en pdf d'une page pour l'imprimer .


utilisateurs :
- user : accès pour voir ses infos
- manager : accès pour pouvoirs le tableau de tous les employer et les modif
- gestion : accès pour pouvoirs le tableau de tous les employer et les modif
- admin : tous les droits


config info role :
- name
- lastname
- email
- password

- if user
    - voir ses infos public ( possibilité de faire un reset de mdp )
    - faire une demande de mot de passe oublié pour soit meme
    ( if user c'est que il n'est pas encore  lié a  un resteaurant )


- if employer
    - est lié a un ou plusieur restaurants
    - faire une demande de mot de passe oublié pour soit meme
    - voir et modif ses infos public ( possibilier de faire un reset de mdp )
    - pouvoir voir les donnés du tableau repas equipier du mcdo ou il travail


- if manager
    - voir et modif les infos public ( pas possibilité de modif les mdp ) de tous les employer qui travail dans le mcdo ou il as les droits
    - faire une demande de mot de passe oublié pour soit meme
    - pouvoir voir et remplire les donnés du tableau repas equipier du mcdo ou il as les droits
    - mcdo sur les quel il as les perm de voir/edit planing hello mcdo
- if gestion
    - voir et modif les infos public ( possibiliter de faire des reset de mdp ) de tous les employer/manager/gestion qui travail dans le mcdo ou il as les droits 
    - faire une demande de mot de passe oublié pour soit meme ou un employer/manager des resto ou il as les droit 
    - peut ajouter/supprimer des employer / manager au resto sur les quel il as les droit
    - pouvoir voir et remplire les donnés du tableau repas equipier du mcdo ou il as les droits
    - mcdo sur les quel il as les perm de voir/edit planing hello mcdo
    - peut crée des user avec des mdp temporaire qui sont modifier a la premiere connexion 


- if admin
    - as tous les droit sur tous l'app 


( il est possible d'etre employer dans un restaurant et manager dans un autre )